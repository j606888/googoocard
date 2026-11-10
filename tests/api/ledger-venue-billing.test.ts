// 場地的收費方式跟著分部（docs/finance-v2/07 #9）：場地屬於一個分部，次數包和場地費都從那個分部負責人的錢付；
// 「場地費」行的金額 = 每次付的價，或次數包先買先用的單價。
import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createMember, createLesson, createLocation, createVenue, enableFinanceFor } from "../factories";
import type { SplitRule } from "@/domains/finance/types";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
import { POST as POST_PACK } from "@/app/api/finance/packs/route";
import { POST as CREATE_RUN } from "@/app/api/finance/payouts/route";
import { syncLedger } from "@/service/ledger/sync";
import { previewOpening } from "@/service/ledger/opening";

const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 台北
const req = (body: unknown) =>
  new Request("http://t/", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ctx = { params: Promise.resolve({}) } as never;

describe("venue billing follows the venue's branch", () => {
  let classroomId: number;
  let dingId: number;
  let seanId: number;
  let T: number; // 台南：丁丁負責
  let K: number; // 高雄：Sean 負責

  const sum = async (key: string, where: Record<string, unknown> = {}) =>
    (await prisma.journalLine.aggregate({ where: { classroomId, account: { systemKey: key }, ...where }, _sum: { amount: true } }))._sum.amount ?? 0;
  const accountOf = (userId: number) => prisma.moneyAccount.findFirstOrThrow({ where: { classroomId, holderUserId: userId } });

  const ruledLesson = async (venueId: number) => {
    const rule: SplitRule = { lines: [{ kind: "venuePack", venueId }], rest: { type: "fund", locationId: T }, fundLocationId: T };
    const { lesson } = await createLesson(classroomId, { locationId: T });
    await prisma.lessonSplitRule.create({ data: { lessonId: lesson.id, rule, updatedById: dingId } });
    return lesson;
  };
  const taken = (lessonId: number, iso: string) =>
    prisma.lessonPeriod.create({
      data: { lessonId, startTime: new Date(iso), endTime: new Date(new Date(iso).getTime() + 3600_000), attendanceTakenAt: new Date(iso) },
    });

  beforeEach(async () => {
    vi.useRealTimers();
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    seanId = (await createMember(classroomId, { email: "sean@test.local", name: "Sean", role: "admin" })).id;
    await prisma.membership.updateMany({ where: { classroomId }, data: { isCustodian: true, canSettle: true } });
    await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: dingId });
    T = (await createLocation(classroomId, { name: "台南", sortOrder: 0 })).id;
    K = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
    await prisma.location.update({ where: { id: T }, data: { keeperUserId: dingId } });
    await prisma.location.update({ where: { id: K }, data: { keeperUserId: seanId } });
    auth.userId = dingId;
    auth.classroomId = classroomId;
  });

  it("a pack is paid from the venue branch keeper's account; using it credits that branch's prepaid", async () => {
    const steps = await createVenue(classroomId, { name: "24steps", locationId: K });
    const res = await POST_PACK(req({ venueId: steps.id, sessions: 10, price: 4000, purchasedAt: "2026-11-01" }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).paidByUserId).toBe(seanId);

    const lesson = await ruledLesson(steps.id);
    await taken(lesson.id, "2026-11-02T12:00:00Z");
    await syncLedger(classroomId);

    const sean = await accountOf(seanId);
    const seanCash = (await prisma.journalLine.aggregate({ where: { classroomId, accountId: sean.accountId }, _sum: { amount: true } }))._sum.amount;
    expect(seanCash).toBe(-400000);
    // 預付場地費在高雄：買 +4000、上一堂 −400
    expect(await sum("PREPAID_VENUE", { locationId: K })).toBe(360000);
    expect(await sum("PREPAID_VENUE", { locationId: T })).toBe(0);
    // 場地費用記在上課的分部（這堂課的基金）
    expect(await sum("EXPENSE_VENUE", { locationId: T })).toBe(40000);
  });

  it("costs land on the lesson's own branch even when the rule's fund is another branch", async () => {
    const hall = await createVenue(classroomId, { name: "大樓", locationId: T, perSessionPrice: 500 });
    // 從高雄的課複製過來的規則：公積金是高雄，但課標在台南
    const rule: SplitRule = { lines: [{ kind: "venuePack", venueId: hall.id }], rest: { type: "fund", locationId: K }, fundLocationId: K };
    const { lesson } = await createLesson(classroomId, { locationId: T });
    await prisma.lessonSplitRule.create({ data: { lessonId: lesson.id, rule, updatedById: dingId } });
    await taken(lesson.id, "2026-11-02T12:00:00Z");
    await syncLedger(classroomId);

    expect(await sum("EXPENSE_VENUE", { locationId: T })).toBe(50000);
    expect(await sum("EXPENSE_VENUE", { locationId: K })).toBe(0);
  });

  it("a per-session venue charges its price each period, payable paid by the venue branch keeper", async () => {
    const hall = await createVenue(classroomId, { name: "大樓", locationId: K, perSessionPrice: 500 });
    const lesson = await ruledLesson(hall.id);
    await taken(lesson.id, "2026-11-02T12:00:00Z");
    await taken(lesson.id, "2026-11-03T12:00:00Z");
    await syncLedger(classroomId);

    expect(await sum("EXPENSE_VENUE", { locationId: T })).toBe(100000);
    expect(await sum("VENUE_PAYABLE", { locationId: T, partyType: "VENUE", partyId: hall.id })).toBe(-100000);

    const run = await (await CREATE_RUN(req({ asOf: "2026-11-30" }), ctx)).json();
    const payout = run.payouts.find((p: { partyType: string; partyId: number }) => p.partyType === "VENUE" && p.partyId === hall.id);
    expect(payout).toMatchObject({ amount: 100000, locationId: T, fromMoneyAccountId: (await accountOf(seanId)).id });
  });

  it("opening: a pack bought before the conversion date sits in the venue's branch", async () => {
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeOpenedAt: null, financeConversionDate: null } });
    const steps = await createVenue(classroomId, { name: "24steps", locationId: K });
    const res = await POST_PACK(req({ venueId: steps.id, before: { totalSessions: 6, totalPrice: 3000, remaining: 4 } }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sessions: 4, price: 2000, paidByUserId: seanId });

    const preview = await previewOpening(classroomId, { conversionDate: "2026-11-01", method: "CONVENTION", cash: [], payables: [] });
    const prepaid = preview.rows.filter((r) => r.label === "預付場地費");
    expect(prepaid).toEqual([expect.objectContaining({ locationId: K, amount: 200000 })]);
  });
});
