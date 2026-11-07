// 財務 v2 P2 驗收：設計文件 §14 的十一月情境過帳後，老師可發金額、分部往來、現金、預收、各分部利潤
// 都要對（docs/finance-v2/06-phases.md P2）。
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
  createTeacher,
  createVenue,
  createVenuePack,
  enableFinanceFor,
} from "../factories";
import { syncLedger } from "@/service/ledger/sync";
import { checkLedger } from "@/service/ledger/check";
import type { SplitRule } from "@/domains/finance/types";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));
import { POST as SYNC } from "@/app/api/finance/ledger/sync/route";
import { GET as CHECK } from "@/app/api/finance/ledger/check/route";

const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 台北
const at = (ymd: string, hour = 11) => new Date(`${ymd}T${String(hour - 8).padStart(2, "0")}:00:00Z`); // 台北時間

type W = Awaited<ReturnType<typeof seedNovember>>;

async function seedNovember(classroomId: number, dingId: number) {
  const seanId = (await createMember(classroomId, { email: "sean@test.local", name: "Sean", role: "admin" })).id;
  await prisma.membership.updateMany({ where: { classroomId }, data: { isCustodian: true, canSettle: true } });
  await enableFinanceFor(classroomId, { launch: LAUNCH, legacyCustodianUserId: seanId });

  const T = await createLocation(classroomId, { name: "台南", sortOrder: 0 });
  const K = await createLocation(classroomId, { name: "高雄", sortOrder: 1 });
  await prisma.location.update({ where: { id: T.id }, data: { keeperUserId: dingId } });
  await prisma.location.update({ where: { id: K.id }, data: { keeperUserId: seanId } });

  const tDing = await createTeacher(classroomId, { name: "丁丁", userId: dingId });
  const tCharlene = await createTeacher(classroomId, { name: "Charlene", payerUserId: dingId });
  const tNora = await createTeacher(classroomId, { name: "Nora", payerUserId: dingId });
  const tSean = await createTeacher(classroomId, { name: "Sean", userId: seanId });
  const tPartner = await createTeacher(classroomId, { name: "高雄搭檔", payerUserId: seanId });
  const home = await createVenue(classroomId, { name: "丁丁家", landlordUserId: dingId });
  const steps = await createVenue(classroomId, { name: "24steps" });
  const pack = await createVenuePack(classroomId, steps.id, { sessions: 10, price: 4050, paidByUserId: seanId, purchasedAt: at("2026-11-05") });

  const tainanRule = (partner: number): SplitRule => ({
    lines: [
      { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: tDing.id } },
      { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: partner } },
      { kind: "fixed", amount: 300, to: { type: "venue", venueId: home.id } },
    ],
    rest: { type: "fund", locationId: T.id },
    fundLocationId: T.id,
  });
  const lesson = async (name: string, locationId: number, rule: SplitRule) => {
    const { lesson } = await createLesson(classroomId, { name, locationId });
    await prisma.lessonSplitRule.create({ data: { lessonId: lesson.id, rule, updatedById: dingId } });
    return lesson;
  };
  const thu = await lesson("週四期班", T.id, tainanRule(tNora.id));
  const tue = await lesson("Bachata Lv2", T.id, tainanRule(tCharlene.id));
  const sun = await lesson("Body movement", T.id, {
    lines: [{ kind: "fixed", amount: 300, to: { type: "venue", venueId: home.id } }],
    rest: { type: "teachers", shares: [{ teacherId: tSean.id, weight: 1 }] },
    fundLocationId: T.id,
  });
  const kao = await lesson("Bachata Training", K.id, {
    lines: [
      { kind: "venuePack", venueId: steps.id },
      { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: K.id } },
    ],
    rest: { type: "teachers", shares: [{ teacherId: tSean.id, weight: 1 }, { teacherId: tPartner.id, weight: 1 }] },
    fundLocationId: K.id,
  });

  const period = (lessonId: number, ymd: string) =>
    prisma.lessonPeriod.create({
      data: { lessonId, startTime: at(ymd, 20), endTime: at(ymd, 21), attendanceTakenAt: at(ymd, 21) },
    });

  const cardType = await createCard(classroomId);
  const student = (name: string) => createStudent(classroomId, { name });
  const buy = async (
    name: string,
    ymd: string,
    { price = 2000, sessions = 6, remaining, paidBy, sold }: { price?: number; sessions?: number; remaining: number; paidBy: number | null; sold: number },
  ) => {
    const s = await student(name);
    const c = await createStudentCard(s.id, cardType.id, {
      finalPrice: price, totalSessions: sessions, remainingSessions: remaining, isPaid: paidBy !== null, createdAt: at(ymd, 12),
    });
    await prisma.studentCard.update({
      where: { id: c.id },
      data: { soldLocationId: sold, ...(paidBy !== null ? { paidByUserId: paidBy, paidAt: at(ymd, 12) } : {}) },
    });
    return { studentId: s.id, cardId: c.id };
  };

  const ming = await buy("小明", "2026-11-04", { remaining: 2, paidBy: dingId, sold: T.id });
  const b1 = await buy("B1", "2026-11-04", { sessions: 5, remaining: 3, paidBy: dingId, sold: T.id });
  const b2 = await buy("B2", "2026-11-04", { sessions: 5, remaining: 3, paidBy: dingId, sold: T.id });
  const g1 = await buy("G1", "2026-11-04", { price: 0, sessions: 1, remaining: 0, paidBy: dingId, sold: T.id });
  const hua = await buy("小華", "2026-11-09", { remaining: 3, paidBy: dingId, sold: T.id });
  const qiang = await buy("小強", "2026-11-12", { remaining: 5, paidBy: seanId, sold: K.id });
  const mei = await buy("小美", "2026-11-18", { remaining: 4, paidBy: dingId, sold: T.id });
  const jie = await buy("阿傑", "2026-11-26", { remaining: 5, paidBy: null, sold: T.id });

  const attend = (lessonPeriodId: number, x: { studentId: number; cardId: number }) =>
    prisma.attendanceRecord.create({ data: { lessonPeriodId, studentId: x.studentId, studentCardId: x.cardId, sessionsUsed: 1 } });
  const dropIn = async (lessonPeriodId: number, amount: number, paidBy: number, ymd: string) => {
    const s = await student(`單堂${amount}`);
    const r = await prisma.attendanceRecord.create({ data: { lessonPeriodId, studentId: s.id, studentCardId: null } });
    await prisma.dropInCharge.create({ data: { attendanceRecordId: r.id, amount, isPaid: true, paidAt: at(ymd, 20), paidByUserId: paidBy } });
  };

  const L1 = await period(thu.id, "2026-11-05");
  await attend(L1.id, b1);
  await attend(L1.id, b2);
  await dropIn(L1.id, 450, dingId, "2026-11-05");
  const L2 = await period(sun.id, "2026-11-09");
  for (const x of [ming, hua, g1]) await attend(L2.id, x);
  const L3 = await period(tue.id, "2026-11-11");
  for (const x of [ming, hua, mei]) await attend(L3.id, x); // 小美 11/18 才買卡，回頭扣 L3
  const L4 = await period(kao.id, "2026-11-12");
  for (const x of [qiang, ming]) await attend(L4.id, x);
  await dropIn(L4.id, 350, seanId, "2026-11-12");
  const L5 = await period(thu.id, "2026-11-12");
  await attend(L5.id, b1);
  await prisma.attendanceAbsence.create({ data: { lessonPeriodId: L5.id, studentId: b2.studentId, studentCardId: b2.cardId, sessionsUsed: 1 } });
  const L6 = await period(tue.id, "2026-11-26");
  for (const x of [ming, hua, mei, jie]) await attend(L6.id, x);

  await prisma.financeExpense.create({
    data: { classroomId, date: at("2026-11-20"), amount: 500, locationId: T.id, category: "廣告", paidByUserId: dingId, createdById: dingId },
  });
  await prisma.financeExpense.create({
    data: { classroomId, date: at("2026-11-22"), amount: 210, locationId: K.id, category: "飲料", paidByUserId: seanId, createdById: seanId },
  });

  return { seanId, T, K, tDing, tCharlene, tNora, tSean, tPartner, pack, jie, L6 };
}

/** 某科目（systemKey）的餘額（分，借正貸負），可依分部、對象篩。 */
async function balance(classroomId: number, key: string, where: { locationId?: number; partyType?: string; partyId?: number; upTo?: string } = {}) {
  const r = await prisma.journalLine.aggregate({
    where: {
      classroomId,
      account: { systemKey: key },
      ...(where.locationId !== undefined ? { locationId: where.locationId } : {}),
      ...(where.partyType !== undefined ? { partyType: where.partyType } : {}),
      ...(where.partyId !== undefined ? { partyId: where.partyId } : {}),
      ...(where.upTo ? { date: { lte: new Date(`${where.upTo}T00:00:00Z`) } } : {}),
    },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

async function cashOf(classroomId: number, holderUserId: number) {
  const ma = await prisma.moneyAccount.findFirstOrThrow({ where: { classroomId, holderUserId } });
  const r = await prisma.journalLine.aggregate({ where: { classroomId, accountId: ma.accountId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

/** 分部利潤（分）：收入（貸，負）＋費用（借，正）取負號。 */
async function profit(classroomId: number, locationId: number) {
  const r = await prisma.journalLine.aggregate({
    where: { classroomId, locationId, account: { type: { in: ["INCOME", "EXPENSE"] } } },
    _sum: { amount: true },
  });
  return -(r._sum.amount ?? 0);
}

describe("ledger posting — November scenario (finance v2 P2)", () => {
  let classroomId: number;
  let dingId: number;
  let w: W;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    w = await seedNovember(classroomId, dingId);
    auth.userId = dingId;
    auth.classroomId = classroomId;
  });

  it("API: settle member can sync; anyone can run the health check; non-settlers can't sync", async () => {
    const noParams = { params: Promise.resolve({}) };
    const res = await SYNC(new Request("http://t/api", { method: "POST" }), noParams);
    expect(res.status).toBe(200);
    const check = await CHECK(new Request("http://t/api"), noParams);
    expect(await check.json()).toMatchObject({ ok: true, problems: [] });

    const other = await createMember(classroomId, { email: "nora@test.local", name: "Nora" });
    auth.userId = other.id;
    expect((await SYNC(new Request("http://t/api", { method: "POST" }), noParams)).status).toBe(403);
    expect((await CHECK(new Request("http://t/api"), noParams)).status).toBe(200);
  });

  it("posts every source, balanced, and the ledger is healthy", async () => {
    const r = await syncLedger(classroomId);
    expect(r.errors).toEqual([]);
    expect(r.entriesWritten).toBeGreaterThan(0);
    expect(await checkLedger(classroomId)).toEqual([]);

    const total = await prisma.journalLine.aggregate({ where: { classroomId }, _sum: { amount: true } });
    expect(total._sum.amount).toBe(0);
  });

  it("is idempotent", async () => {
    await syncLedger(classroomId);
    const n = await prisma.journalEntry.count({ where: { classroomId } });
    const again = await syncLedger(classroomId);
    expect(again).toEqual({ entriesWritten: 0, sourcesChanged: 0, errors: [] });
    expect(await prisma.journalEntry.count({ where: { classroomId } })).toBe(n);
  });

  it("teachers can be paid exactly what feat/finance computed; the unpaid card's share is held", async () => {
    await syncLedger(classroomId);
    const payable = (teacherId: number) => balance(classroomId, "TEACHER_PAYABLE", { partyType: "TEACHER", partyId: teacherId });
    const held = (teacherId: number) => balance(classroomId, "TEACHER_PAYABLE_HELD", { partyType: "TEACHER", partyId: teacherId });

    // spec §14.4：丁丁 1,350、Nora 683.34、Charlene 666.66、Sean 641.92、高雄搭檔 275.25（分，可差 1 分尾差）
    expect(-(await payable(w.tDing.id))).toBeCloseTo(135000, -1);
    expect(-(await payable(w.tNora.id))).toBeCloseTo(68334, -1);
    expect(-(await payable(w.tCharlene.id))).toBeCloseTo(66666, -1);
    expect(-(await payable(w.tSean.id))).toBeCloseTo(64192, -1);
    expect(-(await payable(w.tPartner.id))).toBeCloseTo(27525, -1);
    // 阿傑沒付款：L6 多出的 1/3 份先不發
    expect(-(await held(w.tDing.id))).toBe(11111);
    expect(-(await held(w.tCharlene.id))).toBe(11111);
    expect(await held(w.tNora.id)).toBe(0);
  });

  it("cash, deferred revenue, interbranch and branch profit match the hand-computed month", async () => {
    await syncLedger(classroomId);
    // 現金只看收付：丁丁 10,450 − 500；Sean 2,350 − 4,050 − 210
    expect(await cashOf(classroomId, dingId)).toBe(995000);
    expect(await cashOf(classroomId, w.seanId)).toBe(-191000);

    // 預收：台南 5,400＋阿傑剩 5 格；高雄 小強剩 5 格（最後一格吃尾差）
    expect(-(await balance(classroomId, "DEFERRED_REVENUE", { locationId: w.T.id }))).toBe(706670);
    expect(-(await balance(classroomId, "DEFERRED_REVENUE", { locationId: w.K.id }))).toBe(166667);
    expect(await balance(classroomId, "AR")).toBe(200000);

    // 小明用台南的卡上高雄的課 → 台南欠高雄一格
    expect(await balance(classroomId, "INTERBRANCH", { locationId: w.T.id })).toBe(-33333);
    expect(await balance(classroomId, "INTERBRANCH", { locationId: w.K.id })).toBe(33333);

    // 預付場地：24steps 用了 1 次
    expect(await balance(classroomId, "PREPAID_VENUE")).toBe(405000 - 40500);

    // 分部利潤＝公積金變化：台南 −238.89（舊版 −350 ＋ 阿傑那格 111.11）、高雄 61.17 − 210
    expect(await profit(classroomId, w.T.id)).toBeCloseTo(-23889, -1);
    expect(await profit(classroomId, w.K.id)).toBeCloseTo(6117 - 21000, -1);
  });

  it("a change after the lock date is posted the day after the lock, and old entries never move", async () => {
    await syncLedger(classroomId);
    await prisma.classroom.update({ where: { id: classroomId }, data: { financeLockDate: new Date("2026-11-30T00:00:00Z") } });
    const before = await prisma.journalLine.count({ where: { classroomId, date: { lte: new Date("2026-11-30T00:00:00Z") } } });

    // 12/8 阿傑付款給丁丁
    await prisma.studentCard.update({ where: { id: w.jie.cardId }, data: { isPaid: true, paidAt: at("2026-12-08"), paidByUserId: dingId } });
    const r = await syncLedger(classroomId);
    expect(r.errors).toEqual([]);

    expect(await prisma.journalLine.count({ where: { classroomId, date: { lte: new Date("2026-11-30T00:00:00Z") } } })).toBe(before);
    // L6 待學生付款 → 可發，記在 12/1；收款記在 12/8
    const corr = await prisma.journalEntry.findMany({ where: { classroomId, kind: "CORRECTION" }, select: { date: true, sourceType: true } });
    expect(corr.map((e) => [e.sourceType, e.date.toISOString().slice(0, 10)]).sort()).toEqual([
      ["CARD", "2026-12-08"],
      ["PERIOD", "2026-12-01"],
    ]);
    expect(await balance(classroomId, "TEACHER_PAYABLE_HELD")).toBe(0);
    expect(await balance(classroomId, "AR")).toBe(0);
    expect(await checkLedger(classroomId)).toEqual([]);
  });

  it("removing an attendance reverses exactly that attendance", async () => {
    await syncLedger(classroomId);
    const revenueBefore = await balance(classroomId, "REVENUE_LESSON");
    const rec = await prisma.attendanceRecord.findFirstOrThrow({ where: { lessonPeriodId: w.L6.id, studentCardId: w.jie.cardId } });
    await prisma.attendanceRecord.delete({ where: { id: rec.id } });
    await prisma.studentCard.update({ where: { id: w.jie.cardId }, data: { remainingSessions: 6 } });
    await syncLedger(classroomId);
    expect((await balance(classroomId, "REVENUE_LESSON")) - revenueBefore).toBe(33333);
    expect(await balance(classroomId, "TEACHER_PAYABLE_HELD")).toBe(0);
    expect(await checkLedger(classroomId)).toEqual([]);
  });
});
