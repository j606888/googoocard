// 財務 v2 P3：開帳精靈（docs/finance-v2/04-opening-and-cutover.md）。
import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  createLocation,
  createVenue,
  createVenuePack,
  enableFinanceFor,
  jsonRequest,
} from "../factories";
import { checkLedger } from "@/service/ledger/check";
import { syncLedger } from "@/service/ledger/sync";
import { ensureLedgerSetup } from "@/service/ledger/setup";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
import { GET as OPENING_GET, POST as OPEN } from "@/app/api/finance/opening/route";
import { POST as PREVIEW } from "@/app/api/finance/opening/preview/route";
import { GET as MA_GET, POST as MA_POST } from "@/app/api/finance/money-accounts/route";

const noParams = { params: Promise.resolve({}) };
const at = (ymd: string, hour = 12) => new Date(`${ymd}T${String(hour - 8).padStart(2, "0")}:00:00Z`);

type Preview = {
  rows: { locationId: number; group: string; label: string; amount: number }[];
  totals: { locationId: number; assets: number; liabilities: number; equity: number }[];
  legacyCards: { count: number; deferred: number; receivable: number };
  errors: { code: string; userId?: number }[];
};

describe("opening wizard (finance v2 P3)", () => {
  let classroomId: number;
  let dingId: number;
  let seanId: number;
  let T: number;
  let K: number;
  let cardA: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    auth.userId = dingId;
    auth.classroomId = classroomId;

    seanId = (await createMember(classroomId, { email: "sean@test.local", name: "Sean", role: "admin" })).id;
    await prisma.membership.updateMany({ where: { classroomId }, data: { isCustodian: true, canSettle: true } });
    await enableFinanceFor(classroomId, { launch: new Date("2026-10-31T16:00:00Z"), legacyCustodianUserId: seanId });
    T = (await createLocation(classroomId, { name: "台南", sortOrder: 0 })).id;
    K = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
    await prisma.location.update({ where: { id: T }, data: { keeperUserId: dingId } });
    await prisma.location.update({ where: { id: K }, data: { keeperUserId: seanId } });
    await ensureLedgerSetup(classroomId);

    const type = await createCard(classroomId);
    const { lesson } = await createLesson(classroomId, { locationId: K });
    const period = (ymd: string) =>
      prisma.lessonPeriod.create({ data: { lessonId: lesson.id, startTime: at(ymd, 20), endTime: at(ymd, 21), attendanceTakenAt: at(ymd, 21) } });
    const card = async (ymd: string, o: { price: number; remaining: number; isPaid: boolean; paidBy?: number; sold?: number; expiredAt?: Date }) => {
      const s = await createStudent(classroomId, { name: `S${ymd}${o.price}` });
      const sc = await createStudentCard(s.id, type.id, { finalPrice: o.price, totalSessions: 6, remainingSessions: o.remaining, isPaid: o.isPaid, createdAt: at(ymd) });
      await prisma.studentCard.update({
        where: { id: sc.id },
        data: {
          paidByUserId: o.paidBy ?? null,
          soldLocationId: o.sold ?? null,
          ...(o.expiredAt ? { expiredAt: o.expiredAt, closedReason: "EXPIRED" } : {}),
        },
      });
      return { studentId: s.id, cardId: sc.id };
    };

    // A：上線前的舊卡、沒記收款人（→ Sean）；10 月上了 2 堂、11/5 再上 1 堂
    const a = await card("2026-10-01", { price: 2000, remaining: 3, isPaid: true });
    cardA = a.cardId;
    for (const d of ["2026-10-08", "2026-10-15", "2026-11-05"]) {
      const p = await period(d);
      await prisma.attendanceRecord.create({ data: { lessonPeriodId: p.id, studentId: a.studentId, studentCardId: a.cardId, sessionsUsed: 1 } });
    }
    // B：沒付款的舊卡；C：丁丁收的台南卡；D：上線前就過期
    await card("2026-10-20", { price: 2000, remaining: 6, isPaid: false });
    await card("2026-10-25", { price: 1700, remaining: 6, isPaid: true, paidBy: dingId, sold: T });
    await card("2026-04-01", { price: 2000, remaining: 2, isPaid: true, expiredAt: at("2026-10-01") });

    const steps = await createVenue(classroomId, { name: "24steps" });
    await createVenuePack(classroomId, steps.id, { sessions: 10, price: 4050, paidByUserId: seanId, purchasedAt: at("2026-10-15") });
  });

  const preview = async (body: object) => {
    const res = await PREVIEW(jsonRequest("POST", body), noParams);
    expect(res.status).toBe(200);
    return (await res.json()) as Preview;
  };
  const row = (p: Preview, locationId: number, label: string) => p.rows.find((r) => r.locationId === locationId && r.label === label)?.amount ?? 0;

  it("convention: legacy money sits with whoever collected it, each branch's opening fund is what's left", async () => {
    const p = await preview({ conversionDate: "2026-11-01", method: "CONVENTION" });
    expect(p.errors).toEqual([]);
    expect(p.legacyCards).toEqual({ count: 3, deferred: 133334 + 200000 + 170000, receivable: 200000 });

    // 高雄：Sean 手上＝A 的預收；次數包 4,050 是 Sean 先墊的 → 公積金期初 +4,050
    expect(row(p, K, "Sean 手上的現金")).toBe(133334);
    expect(row(p, K, "預收學費")).toBe(133334);
    expect(row(p, K, "預付場地費")).toBe(405000);
    expect(row(p, K, "公積金（期初）")).toBe(405000);
    // 台南：C 在丁丁手上；B 沒付款 → 應收＝預收，公積金 0
    expect(row(p, T, "Owner 手上的現金")).toBe(170000);
    expect(row(p, T, "應收學費")).toBe(200000);
    expect(row(p, T, "預收學費")).toBe(370000);
    expect(row(p, T, "公積金（期初）")).toBe(0);
    for (const t of p.totals) expect(t.assets).toBe(t.liabilities + t.equity);
  });

  it("actual: counted cash replaces the convention and the difference lands in the fund", async () => {
    const { accounts } = (await (await MA_GET(new Request("http://t/api"), noParams)).json()) as { accounts: { id: number; holderUserId: number }[] };
    const ding = accounts.find((a) => a.holderUserId === dingId)!;
    const p = await preview({ conversionDate: "2026-11-01", method: "ACTUAL", cash: [{ moneyAccountId: ding.id, amount: 500 }] });
    expect(row(p, T, "Owner 手上的現金")).toBe(50000);
    expect(row(p, T, "公積金（期初）")).toBe(50000 + 200000 - 370000);
    expect(row(p, K, "公積金（期初）")).toBe(405000 - 133334);
  });

  it("opening writes one OPENING entry, posts from the conversion date on, and the ledger is healthy", async () => {
    const res = await OPEN(jsonRequest("POST", { conversionDate: "2026-11-01", method: "CONVENTION" }), noParams);
    expect(res.status).toBe(200);
    expect(await prisma.journalEntry.count({ where: { classroomId, kind: "OPENING" } })).toBe(1);
    expect(await checkLedger(classroomId)).toEqual([]);
    expect((await syncLedger(classroomId)).entriesWritten).toBe(0);

    // A 在 11/5 上的那堂從預收轉收入：剩 3 格
    const deferredA = await prisma.journalLine.aggregate({
      where: { classroomId, partyType: "STUDENT_CARD", partyId: cardA, account: { systemKey: "DEFERRED_REVENUE" } },
      _sum: { amount: true },
    });
    expect(-(deferredA._sum.amount ?? 0)).toBe(100001);

    const status = await (await OPENING_GET(new Request("http://t/api"), noParams)).json();
    expect(status).toMatchObject({ opened: true, conversionDate: "2026-11-01", canReopen: true });
  });

  it("can reopen on another day before the first lock, and not after", async () => {
    await OPEN(jsonRequest("POST", { conversionDate: "2026-11-01", method: "CONVENTION" }), noParams);
    const res = await OPEN(jsonRequest("POST", { conversionDate: "2026-11-10", method: "CONVENTION" }), noParams);
    expect(res.status).toBe(200);
    expect(await prisma.journalEntry.count({ where: { classroomId, kind: "OPENING" } })).toBe(1);
    // 11/5 那堂現在在轉換日之前：不過帳，算進期初
    expect(await prisma.journalEntry.count({ where: { classroomId, sourceType: "PERIOD" } })).toBe(0);
    expect(await checkLedger(classroomId)).toEqual([]);

    await prisma.classroom.update({ where: { id: classroomId }, data: { financeLockDate: new Date("2026-11-30T00:00:00Z") } });
    expect((await OPEN(jsonRequest("POST", { conversionDate: "2026-11-01", method: "CONVENTION" }), noParams)).status).toBe(409);
  });

  it("only the owner opens; a receiver without a money account blocks opening until one is created", async () => {
    // 小幫手收過一張舊卡、沒有資金帳戶
    const helper = await createMember(classroomId, { email: "helper@test.local", name: "Helper" });
    const s = await createStudent(classroomId, { name: "H" });
    const type = await prisma.card.findFirstOrThrow({ where: { classroomId } });
    const sc = await createStudentCard(s.id, type.id, { finalPrice: 2000, remainingSessions: 6, totalSessions: 6, isPaid: true, createdAt: at("2026-10-28") });
    await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId: helper.id } });

    const p = await preview({ conversionDate: "2026-11-01", method: "CONVENTION" });
    expect(p.errors).toEqual([expect.objectContaining({ code: "NO_MONEY_ACCOUNT", userId: helper.id })]);
    expect((await OPEN(jsonRequest("POST", { conversionDate: "2026-11-01", method: "CONVENTION" }), noParams)).status).toBe(400);

    // 讓他成為保管人並建一個資金帳戶
    expect((await MA_POST(jsonRequest("POST", { holderUserId: helper.id, locationId: T }), noParams)).status).toBe(400); // 還不是保管人
    await prisma.membership.update({ where: { userId_classroomId: { userId: helper.id, classroomId } }, data: { isCustodian: true } });
    expect((await MA_POST(jsonRequest("POST", { holderUserId: helper.id, locationId: T }), noParams)).status).toBe(200);
    expect((await preview({ conversionDate: "2026-11-01", method: "CONVENTION" })).errors).toEqual([]);

    auth.userId = seanId; // admin，但不是 owner
    expect((await OPEN(jsonRequest("POST", { conversionDate: "2026-11-01", method: "CONVENTION" }), noParams)).status).toBe(403);
  });
});
