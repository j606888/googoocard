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
  enableFinanceFor,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as listMonths } from "@/app/api/finance/settlements/route";
import { GET as getStatementRoute, POST as lockRoute } from "@/app/api/finance/settlements/[month]/route";
import { DELETE as voidExpense } from "@/app/api/finance/expenses/[id]/route";
import { DELETE as voidTransfer } from "@/app/api/finance/transfers/[id]/route";
import { DELETE as voidPack } from "@/app/api/finance/packs/[id]/route";
import { getMonthStatement, lockMonth } from "@/service/finance/settlement";
import type { MonthStatement } from "@/service/finance/settlement";
import { getCustody } from "@/service/finance/custody";
import { updateAttendance } from "@/domains/attendance/attendance.service";
import type { SplitRule } from "@/domains/finance/types";

// spec §14 的一部分：L2（週日台南、Sean 的課）、L4（高雄）、L6（台南週二，阿傑待收）。
const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 00:00 台北
const DEC_3 = new Date("2026-12-03T04:00:00Z");
const JAN_3 = new Date("2027-01-03T04:00:00Z");
const noParams = { params: Promise.resolve({}) };
const monthParams = (month: string) => ({ params: Promise.resolve({ month }) });
const req = (path: string, method = "GET") => new Request(`http://test.local/api/finance/settlements${path}`, { method });

const sumTo = (deltas: { payee: { type: string; teacherId?: number; locationId?: number }; amount: number }[], match: (p: { type: string; teacherId?: number; locationId?: number }) => boolean) =>
  deltas.filter((d) => match(d.payee)).reduce((s, d) => s + d.amount, 0);

describe("finance settlement", () => {
  let classroomId: number;
  let dingId: number;
  let seanId: number;
  let tainanId: number;
  let kaoId: number;
  let charleneId: number;
  let tDingId: number;
  let partnerId: number;
  let stepsId: number;
  let l6PeriodId: number;
  let l6LessonId: number;
  let ajieCardId: number;
  let cardTypeId: number;

  beforeEach(async () => {
    await resetDb();
    const c = await createClassroom();
    classroomId = c.id;
    dingId = c.ownerId;
    auth.classroomId = classroomId;
    auth.userId = dingId;
    await seed();
  });

  async function addPeriod(lessonId: number, startIso: string, taken = true) {
    const startTime = new Date(startIso);
    return prisma.lessonPeriod.create({
      data: {
        lessonId,
        startTime,
        endTime: new Date(startTime.getTime() + 3600_000),
        attendanceTakenAt: taken ? startTime : null,
      },
    });
  }

  async function attend(periodId: number, holder: number | null, opts: { paid?: boolean } = {}) {
    const student = await createStudent(classroomId, { name: `S${Math.random()}` });
    const sc = await createStudentCard(student.id, cardTypeId, {
      finalPrice: 2000, totalSessions: 6, remainingSessions: 5, isPaid: opts.paid ?? true,
    });
    if (holder !== null) await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId: holder } });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: periodId, studentId: student.id, studentCardId: sc.id, sessionsUsed: 1 },
    });
    return sc;
  }

  async function seed() {
    seanId = (await createMember(classroomId, { email: "s@test.local", name: "S", role: "admin" })).id;
    await prisma.membership.updateMany({ where: { classroomId }, data: { isFinance: true } });
    await enableFinanceFor(classroomId, { launch: LAUNCH });

    tainanId = (await createLocation(classroomId, { name: "T" })).id;
    await prisma.location.update({ where: { id: tainanId }, data: { keeperUserId: dingId } });
    kaoId = (await createLocation(classroomId, { name: "K" })).id;
    await prisma.location.update({ where: { id: kaoId }, data: { keeperUserId: seanId } });

    tDingId = (await createTeacher(classroomId, { name: "TD", userId: dingId })).id;
    const tSeanId = (await createTeacher(classroomId, { name: "TS", userId: seanId })).id;
    charleneId = (await createTeacher(classroomId, { name: "C", payerUserId: dingId })).id;
    partnerId = (await createTeacher(classroomId, { name: "P", payerUserId: seanId })).id;
    const homeId = (await createVenue(classroomId, { name: "Home", landlordUserId: dingId })).id;
    stepsId = (await createVenue(classroomId, { name: "Steps" })).id;
    cardTypeId = (await createCard(classroomId)).id;

    const rule = async (lessonId: number, r: SplitRule) =>
      prisma.lessonSplitRule.create({ data: { lessonId, rule: r, updatedById: dingId } });

    // L2：場地 300 → 房東，剩下 → TS
    const l2 = (await createLesson(classroomId, { name: "L2", locationId: tainanId })).lesson;
    await rule(l2.id, {
      lines: [{ kind: "fixed", amount: 300, to: { type: "venue", venueId: homeId } }],
      rest: { type: "teachers", shares: [{ teacherId: tSeanId, weight: 1 }] },
      fundLocationId: tainanId,
    });
    const p2 = await addPeriod(l2.id, "2026-11-09T02:00:00Z");
    await attend(p2.id, dingId);
    await attend(p2.id, dingId);

    // L4：外部場地 405（Sean 負責付）、10% 公積金、剩下 TS／搭檔平分
    const l4 = (await createLesson(classroomId, { name: "L4", locationId: kaoId })).lesson;
    await rule(l4.id, {
      lines: [
        { kind: "fixed", amount: 405, to: { type: "venue", venueId: stepsId } },
        { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: kaoId } },
      ],
      rest: { type: "teachers", shares: [{ teacherId: tSeanId, weight: 1 }, { teacherId: partnerId, weight: 1 }] },
      fundLocationId: kaoId,
    });
    const p4 = await addPeriod(l4.id, "2026-11-12T10:00:00Z");
    await attend(p4.id, seanId);
    await attend(p4.id, dingId);
    const dropStudent = await createStudent(classroomId, { name: "Drop" });
    const rec = await prisma.attendanceRecord.create({
      data: { lessonPeriodId: p4.id, studentId: dropStudent.id, sessionsUsed: 1 },
    });
    await prisma.dropInCharge.create({
      data: { attendanceRecordId: rec.id, amount: 350, isPaid: true, paidByUserId: seanId, paidAt: p4.startTime },
    });

    // L6：1/3 TD、1/3 Charlene、場地 300、剩下 → 台南公積金；阿傑沒付
    const l6 = (await createLesson(classroomId, { name: "L6", locationId: tainanId })).lesson;
    l6LessonId = l6.id;
    await rule(l6.id, {
      lines: [
        { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: tDingId } },
        { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: charleneId } },
        { kind: "fixed", amount: 300, to: { type: "venue", venueId: homeId } },
      ],
      rest: { type: "fund", locationId: tainanId },
      fundLocationId: tainanId,
    });
    const p6 = await addPeriod(l6.id, "2026-11-26T11:00:00Z");
    l6PeriodId = p6.id;
    for (let i = 0; i < 3; i++) await attend(p6.id, dingId);
    ajieCardId = (await attend(p6.id, null, { paid: false })).id;
  }

  async function payAjie() {
    await prisma.studentCard.update({
      where: { id: ajieCardId },
      data: { isPaid: true, paidByUserId: dingId, paidAt: new Date("2026-12-08T04:00:00Z") },
    });
  }

  const payoutOf = (s: MonthStatement, match: Partial<MonthStatement["payouts"][number]>) =>
    s.payouts.find((p) => Object.entries(match).every(([k, v]) => p[k as keyof typeof p] === v));

  it("cannot lock before month ends", async () => {
    await expect(
      lockMonth({ classroomId, userId: dingId, month: "2026-11", now: new Date("2026-11-30T15:00:00Z") }),
    ).rejects.toMatchObject({ status: 409, code: "MONTH_NOT_ENDED" });

    // route：牆上時間
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T04:00:00Z"));
    try {
      const res = await lockRoute(req("/2026-11", "POST"), monthParams("2026-11"));
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("MONTH_NOT_ENDED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("can only lock the earliest open month; non-finance cannot lock", async () => {
    await expect(lockMonth({ classroomId, userId: dingId, month: "2026-12", now: JAN_3 })).rejects.toMatchObject({
      status: 409, code: "MONTH_NOT_OPEN",
    });
    const helper = await createMember(classroomId, { email: "h@test.local", name: "H" });
    await expect(lockMonth({ classroomId, userId: helper.id, month: "2026-11", now: DEC_3 })).rejects.toMatchObject({
      status: 403,
    });
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    await expect(lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 })).rejects.toMatchObject({
      status: 409, code: "MONTH_NOT_OPEN",
    });
  });

  it("cannot lock with unallocated money", async () => {
    const { lesson } = await createLesson(classroomId, { name: "NoRule", locationId: tainanId });
    const p = await addPeriod(lesson.id, "2026-11-20T02:00:00Z");
    await attend(p.id, dingId);
    const s = await getMonthStatement(classroomId, "2026-11", DEC_3);
    expect(s.warnings).toContain("UNALLOCATED");
    await expect(lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 })).rejects.toMatchObject({
      status: 409, code: "UNALLOCATED",
    });
  });

  it("statement: periods, by person, payouts, pending, unchecked periods", async () => {
    await addPeriod(l6LessonId, "2026-11-28T11:00:00Z", false); // 還沒點名
    const s = await getMonthStatement(classroomId, "2026-11", DEC_3);
    expect(s.locked).toBe(false);
    expect(s.periods).toHaveLength(3);
    expect(s.adjustments).toEqual([]);
    expect(s.warnings).toContain("UNCHECKED_PERIODS");
    expect(s.uncheckedPeriods).toBe(1);
    expect(s.pending).toEqual([expect.objectContaining({ periodId: l6PeriodId, kind: "unpaid", studentName: expect.any(String) })]);
    expect(s.byBranch.length).toBeGreaterThan(0);
    expect(s.byBranch.find((b) => b.locationId === kaoId)).toMatchObject({ name: expect.any(String) });
    const charlene = s.byPerson.find((p) => p.teacherId === charleneId)!;
    expect(charlene).toMatchObject({ name: "C", payerUserId: dingId, rounded: 333 });
    expect(charlene.total).toBeCloseTo(333.33, 2);

    expect(payoutOf(s, { fromUserId: dingId, toKind: "USER", toUserId: seanId })?.amount).toBe(700);
    expect(payoutOf(s, { fromUserId: dingId, toKind: "TEACHER", toTeacherId: charleneId })?.amount).toBe(333);
    expect(payoutOf(s, { fromUserId: dingId, toKind: "SELF" })?.amount).toBe(933);
    expect(payoutOf(s, { fromUserId: seanId, toKind: "SELF" })?.amount).toBe(642);
    expect(payoutOf(s, { fromUserId: seanId, toKind: "TEACHER", toTeacherId: partnerId })?.amount).toBe(275);
    expect(payoutOf(s, { fromUserId: seanId, toKind: "VENUE", toVenueId: stepsId })?.amount).toBe(405);
    expect(s.payouts).toHaveLength(6);
    expect(s.custodyBefore[seanId].self).toBeCloseTo(641.92, 2);
  });

  it("rounding goes to payer's branch fund", async () => {
    const before = await getCustody(classroomId, "2026-11");
    const kaoFundBefore = before.users.find((u) => u.userId === seanId)!.buckets.funds[kaoId];
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });

    const row = await prisma.financeSettlement.findUniqueOrThrow({ where: { classroomId_month: { classroomId, month: "2026-11" } } });
    const roundings = (row.snapshot as { roundings: { userId: number; bucket: string; locationId: number; amount: number }[] }).roundings;
    const seanSelf = roundings.find((r) => r.userId === seanId && r.bucket === "self")!;
    expect(seanSelf.locationId).toBe(kaoId);
    expect(seanSelf.amount).toBeCloseTo(-0.08, 2);

    const locked = await getMonthStatement(classroomId, "2026-11", DEC_3);
    const kaoBranch = locked.byBranch.find((b) => b.locationId === kaoId)!;
    // 公積金變化含取整零頭：搭檔 +0.25、Sean 自己 −0.08（月結前的保管中不含零頭）
    expect(kaoBranch.fundChange - kaoFundBefore).toBeCloseTo(0.25 - 0.0833, 1);
    expect(locked.byBranch.every((b) => Number.isFinite(b.fundChange))).toBe(true);

    const after = (await getCustody(classroomId, "2026-11")).users.find((u) => u.userId === seanId)!.buckets;
    expect(after.self).toBeCloseTo(642, 5);
    expect(after.teachers[partnerId]).toBeCloseTo(275, 5);
    // 搭檔零頭 +0.25、Sean 自己的 −0.0833
    expect(after.funds[kaoId]).toBeCloseTo(kaoFundBefore + 0.25 - (642 - (366.67 + 275.25)), 2);
    const ding = (await getCustody(classroomId, "2026-11")).users.find((u) => u.userId === dingId)!.buckets;
    expect(ding.teachers[charleneId]).toBeCloseTo(333, 5);
    expect(ding.self).toBeCloseTo(933, 5);
  });

  it("late payment after lock lands in next month (case 9)", async () => {
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    const novBefore = await getMonthStatement(classroomId, "2026-11", DEC_3);
    expect(novBefore.locked).toBe(true);

    await payAjie();

    const nov = await getMonthStatement(classroomId, "2026-11", DEC_3);
    expect(nov).toEqual(novBefore);
    const dec = await getMonthStatement(classroomId, "2026-12", JAN_3);
    expect(dec.periods).toEqual([]);
    expect(dec.adjustments).toHaveLength(1);
    const adj = dec.adjustments[0];
    expect(adj).toMatchObject({ periodId: l6PeriodId, lessonName: "L6", reason: "late" });
    expect(adj.deltas).toHaveLength(3);
    expect(sumTo(adj.deltas, (p) => p.type === "teacher" && p.teacherId === tDingId)).toBeCloseTo(111.11, 2);
    expect(sumTo(adj.deltas, (p) => p.type === "teacher" && p.teacherId === charleneId)).toBeCloseTo(111.11, 2);
    expect(sumTo(adj.deltas, (p) => p.type === "fund" && p.locationId === tainanId)).toBeCloseTo(111.11, 2);
    expect(dec.byPerson.find((p) => p.teacherId === charleneId)!.total).toBeCloseTo(111.11, 2);
    // 還沒轉帳：十一月剩 333 ＋ 十二月 111.11
    expect(payoutOf(dec, { fromUserId: dingId, toKind: "TEACHER", toTeacherId: charleneId })?.amount).toBe(444);

    // 帳本：十一月不變、十二月加上差額
    const novCustody = (await getCustody(classroomId, "2026-11")).users.find((u) => u.userId === dingId)!.buckets;
    const decCustody = (await getCustody(classroomId, "2026-12")).users.find((u) => u.userId === dingId)!.buckets;
    expect(decCustody.teachers[charleneId] - novCustody.teachers[charleneId]).toBeCloseTo(111.11, 2);
    expect(decCustody.funds[tainanId] - novCustody.funds[tainanId]).toBeCloseTo(111.11, 2);
  });

  it("custody through a locked month keeps the prepaid from lock time (issue 07)", async () => {
    const locked = await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    // 鎖住之後：阿傑補付（他的卡 5 格進預收）、又有人買新卡
    await payAjie();
    const student = await createStudent(classroomId, { name: "New" });
    const sc = await createStudentCard(student.id, cardTypeId, {
      finalPrice: 2000, totalSessions: 6, remainingSessions: 6, isPaid: true,
    });
    await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId: seanId } });

    const nov = await getCustody(classroomId, "2026-11");
    for (const userId of [dingId, seanId]) {
      const b = nov.users.find((u) => u.userId === userId)!.buckets;
      expect(b.prepaid).toBeCloseTo(locked.custodyBefore[userId].prepaid, 5);
      expect(b.cash).toBeCloseTo(locked.custodyBefore[userId].cash, 5);
    }
    // 沒有指定月份（現況）仍是現在的預收
    const now = (await getCustody(classroomId)).users.find((u) => u.userId === seanId)!.buckets;
    expect(now.prepaid).toBeCloseTo(locked.custodyBefore[seanId].prepaid + 2000, 5);
  });

  it("delta appears once and is absorbed by the next lock", async () => {
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    await payAjie();
    const decLocked = await lockMonth({ classroomId, userId: dingId, month: "2026-12", now: JAN_3 });
    expect(decLocked.locked).toBe(true);
    expect(decLocked.adjustments).toHaveLength(1);

    const jan = await getMonthStatement(classroomId, "2027-01", new Date("2027-02-03T04:00:00Z"));
    expect(jan.adjustments).toEqual([]);
    // 帳本：差額只算一次
    const decCustody = (await getCustody(classroomId, "2026-12")).users.find((u) => u.userId === dingId)!.buckets;
    const all = (await getCustody(classroomId)).users.find((u) => u.userId === dingId)!.buckets;
    expect(all.teachers[charleneId]).toBeCloseTo(decCustody.teachers[charleneId], 5);
  });

  it("expense dated in a locked month lands in the open month", async () => {
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    const nov = await getMonthStatement(classroomId, "2026-11", DEC_3);
    const fundBefore = (await getCustody(classroomId, "2026-11")).users.find((u) => u.userId === dingId)!.buckets.funds[tainanId];
    const late = await prisma.financeExpense.create({
      data: {
        classroomId, date: new Date("2026-11-20T04:00:00Z"), amount: 500, locationId: tainanId,
        category: "廣告", paidByUserId: dingId, createdById: dingId,
      },
    });
    expect(await getMonthStatement(classroomId, "2026-11", DEC_3)).toEqual(nov);
    const dec = await getMonthStatement(classroomId, "2026-12", JAN_3);
    expect(dec.expenses.map((e) => e.id)).toEqual([late.id]);
    const custody = (id: string) => getCustody(classroomId, id).then((c) => c.users.find((u) => u.userId === dingId)!.buckets);
    expect((await custody("2026-11")).funds[tainanId]).toBeCloseTo(fundBefore, 5);
    expect((await custody("2026-12")).funds[tainanId]).toBeCloseTo(fundBefore - 500, 5);

    await lockMonth({ classroomId, userId: dingId, month: "2026-12", now: JAN_3 });
    expect((await getMonthStatement(classroomId, "2027-01", JAN_3)).expenses).toEqual([]);
    expect((await custody("2026-12")).funds[tainanId]).toBeCloseTo(fundBefore - 500, 5);
  });

  it("late attendance on a locked-month period with no baseline → one adjustment in the open month", async () => {
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    const p = await addPeriod(l6LessonId, "2026-11-28T11:00:00Z");
    await attend(p.id, dingId);
    const dec = await getMonthStatement(classroomId, "2026-12", JAN_3);
    expect(dec.periods).toEqual([]);
    const adj = dec.adjustments.filter((a) => a.periodId === p.id);
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ lessonName: "L6", date: "2026-11-28T11:00:00.000Z" });
    expect(sumTo(adj[0].deltas, (x) => x.type === "teacher" && x.teacherId === charleneId)).toBeCloseTo(2000 / 18, 2);
    await lockMonth({ classroomId, userId: dingId, month: "2026-12", now: JAN_3 });
    expect((await getMonthStatement(classroomId, "2027-01", JAN_3)).adjustments).toEqual([]);
  });

  it("period moved into the open month after lock shows only as an adjustment", async () => {
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    const moved = new Date("2026-12-10T11:00:00Z");
    await prisma.lessonPeriod.update({ where: { id: l6PeriodId }, data: { startTime: moved, attendanceTakenAt: moved } });
    await payAjie();
    const dec = await getMonthStatement(classroomId, "2026-12", JAN_3);
    expect(dec.periods.map((p) => p.periodId)).not.toContain(l6PeriodId);
    expect(dec.adjustments.map((a) => a.periodId)).toEqual([l6PeriodId]);
    expect(dec.byPerson.find((x) => x.teacherId === charleneId)!.total).toBeCloseTo(111.11, 2);
  });

  it("period that leaves the live data after lock keeps its snapshot name/date in the adjustment", async () => {
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    const p2 = await prisma.lessonPeriod.findFirstOrThrow({ where: { lesson: { name: "L2" } } });
    await prisma.lessonPeriod.update({ where: { id: p2.id }, data: { attendanceTakenAt: null } });
    const dec = await getMonthStatement(classroomId, "2026-12", JAN_3);
    const adj = dec.adjustments.find((a) => a.periodId === p2.id)!;
    expect(adj).toMatchObject({ lessonName: "L2", date: p2.startTime.toISOString() });
    expect(sumTo(adj.deltas, () => true)).toBeCloseTo(-2 * (2000 / 6), 2);
  });

  it("expiry in a locked month: a later refund to the expired card is an adjustment in the open month (R26)", async () => {
    const p2 = await prisma.lessonPeriod.findFirstOrThrow({ where: { lesson: { name: "L2" } }, include: { lesson: true } });
    const keep = (await prisma.attendanceRecord.findMany({ where: { lessonPeriodId: p2.id } })).map((r) => r.studentId);
    // 一張 600／6 格的卡：上了 L2（十一月 9 日）、十一月 20 日過期時剩 3 格 → 過期收入 300 進台南公積金。
    const student = await createStudent(classroomId, { name: "Exp" });
    const sc = await createStudentCard(student.id, cardTypeId, { finalPrice: 600, totalSessions: 6, remainingSessions: 3, isPaid: true });
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { paidByUserId: dingId, soldLocationId: tainanId, expiredAt: new Date("2026-11-20T04:00:00Z"), closedReason: "EXPIRED" },
    });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: p2.id, studentId: student.id, studentCardId: sc.id, sessionsUsed: 1 },
    });

    const locked = await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    expect(locked.expiries.map((e) => [e.studentCardId, e.value])).toEqual([[sc.id, 300]]);
    const row = await prisma.financeSettlement.findUniqueOrThrow({ where: { classroomId_month: { classroomId, month: "2026-11" } } });
    expect((row.snapshot as { eventIds: { expiries: unknown[] } }).eventIds.expiries).toEqual([
      { id: sc.id, value: 300, holderUserId: dingId, to: { type: "fund", locationId: tainanId } },
    ]);
    const novCustody = await getCustody(classroomId, "2026-11");

    // 取消這位學生的出席 → 退 1 格到已過期的卡：過期收入變 400。
    await updateAttendance({ lessonId: p2.lessonId, lessonPeriodId: p2.id, studentIds: keep });
    expect((await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } })).remainingSessions).toBe(4);

    expect(await getCustody(classroomId, "2026-11")).toEqual(novCustody);
    expect(await getMonthStatement(classroomId, "2026-11", DEC_3)).toEqual(locked);

    const dec = await getMonthStatement(classroomId, "2026-12", JAN_3);
    expect(dec.expiries).toEqual([]);
    expect(dec.expiryAdjustments).toEqual([
      { studentCardId: sc.id, serial: expect.any(String), deltas: [{ to: { type: "fund", locationId: tainanId }, amount: 100 }] },
    ]);
    const p2adj = dec.adjustments.find((a) => a.periodId === p2.id)!;
    expect(sumTo(p2adj.deltas, () => true)).toBeCloseTo(-100, 5);
    // 現金沒變：這堂少 100、過期收入多 100（computeCustody 在測試裡會檢查不變式）
    const cash = (c: Awaited<ReturnType<typeof getCustody>>) => c.users.reduce((sum, u) => sum + u.buckets.cash, 0);
    const decCustody = await getCustody(classroomId, "2026-12");
    expect(cash(decCustody)).toBeCloseTo(cash(novCustody), 5);
    const fund = (c: Awaited<ReturnType<typeof getCustody>>) => c.users.find((u) => u.userId === dingId)!.buckets.funds[tainanId];
    // 公積金：過期 +100；L2 的剩餘本來全給老師，所以這堂的差額不動公積金
    expect(fund(decCustody) - fund(novCustody)).toBeCloseTo(100, 5);
    expect(dec.byBranch.find((b) => b.locationId === tainanId)!.fundChange).toBeCloseTo(100, 5);

    // 下次鎖定吸收：一月沒有調整，帳本只算一次
    await lockMonth({ classroomId, userId: dingId, month: "2026-12", now: JAN_3 });
    const jan = await getMonthStatement(classroomId, "2027-01", new Date("2027-02-03T04:00:00Z"));
    expect(jan.expiryAdjustments).toEqual([]);
    expect(fund(await getCustody(classroomId))).toBeCloseTo(fund(decCustody), 5);
  });

  it("cannot void an expense, transfer or pack in a locked month", async () => {
    const mk = async (date: Date) => ({
      expense: await prisma.financeExpense.create({
        data: { classroomId, date, amount: 100, locationId: tainanId, category: "x", paidByUserId: dingId, createdById: dingId },
      }),
      transfer: await prisma.financeTransfer.create({
        data: { classroomId, date, amount: 100, fromUserId: dingId, toKind: "USER", toUserId: seanId, createdById: dingId },
      }),
      pack: await prisma.venuePack.create({
        data: { classroomId, venueId: stepsId, sessions: 10, price: 4050, paidByUserId: seanId, purchasedAt: date, createdById: seanId },
      }),
    });
    const nov = await mk(new Date("2026-11-15T04:00:00Z"));
    await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    const dec = await mk(new Date("2026-12-02T04:00:00Z"));
    const del = (id: number) => [new Request("http://test.local", { method: "DELETE" }), { params: Promise.resolve({ id: String(id) }) }] as const;

    for (const [route, rec] of [[voidExpense, nov.expense], [voidTransfer, nov.transfer], [voidPack, nov.pack]] as const) {
      const res = await route(...del(rec.id));
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("MONTH_LOCKED");
    }
    for (const [route, rec] of [[voidExpense, dec.expense], [voidTransfer, dec.transfer], [voidPack, dec.pack]] as const) {
      expect((await route(...del(rec.id))).status).toBe(200);
    }
    expect(await prisma.financeExpense.count({ where: { id: nov.expense.id, voidedAt: null } })).toBe(1);
  });

  it("locked month snapshot unchanged after rule edit", async () => {
    const locked = await lockMonth({ classroomId, userId: dingId, month: "2026-11", now: DEC_3 });
    await prisma.lessonSplitRule.update({
      where: { lessonId: l6LessonId },
      data: {
        rule: { lines: [], rest: { type: "teachers", shares: [{ teacherId: charleneId, weight: 1 }] }, fundLocationId: tainanId },
      },
    });
    const nov = await getMonthStatement(classroomId, "2026-11", DEC_3);
    expect(nov).toEqual(JSON.parse(JSON.stringify(locked)));
    const dec = await getMonthStatement(classroomId, "2026-12", JAN_3);
    const adj = dec.adjustments.find((a) => a.periodId === l6PeriodId)!;
    expect(sumTo(adj.deltas, (p) => p.type === "teacher" && p.teacherId === charleneId)).toBeCloseTo(1000 - 333.33, 2);
  });

  it("routes: list months, read statement (any member), lock (finance)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(DEC_3);
    try {
      await routesScenario();
    } finally {
      vi.useRealTimers();
    }
  });

  async function routesScenario() {
    const helper = await createMember(classroomId, { email: "h@test.local", name: "H" });
    auth.userId = helper.id;
    const list = await listMonths(req(""), noParams);
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.openMonth).toBe("2026-11");
    expect(body.months[0]).toMatchObject({ month: "2026-11", locked: false });

    const st = await getStatementRoute(req("/2026-11"), monthParams("2026-11"));
    expect(st.status).toBe(200);
    expect((await st.json()).month).toBe("2026-11");
    expect((await getStatementRoute(req("/2026-13"), monthParams("2026-13"))).status).toBe(400);
    expect((await lockRoute(req("/2026-11", "POST"), monthParams("2026-11"))).status).toBe(403);

    auth.userId = dingId;
    const ok = await lockRoute(req("/2026-11", "POST"), monthParams("2026-11"));
    expect(ok.status).toBe(200);
    const after = await (await listMonths(req(""), noParams)).json();
    expect(after.openMonth).toBe("2026-12");
    expect(after.months[0]).toMatchObject({ month: "2026-11", locked: true, lockedById: dingId });
  }
});
