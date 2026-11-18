import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createLesson,
  createLocation,
  createStudentCard,
  jsonRequest,
  routeParams,
} from "../factories";

// 財務輕量版（docs/finance-lite.md）：每堂分帳、卡錢分部、結清快照、分部往來。
const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
  readAuthSession: async () => auth,
}));

import { getPeriodFinance, settlePeriod, unsettlePeriod } from "@/service/finance/period";
import { getBalances, listUnsettledPeriods } from "@/service/finance/balance";
import { setLessonRule, setPeriodOverride } from "@/service/finance/rules";
import { DELETE as deletePeriod } from "@/app/api/lessons/[id]/periods/[periodId]/route";
import { POST as buyCard } from "@/app/api/students/[id]/student-cards/route";
import { performConversion } from "@/service/studentCardConversion";

const START = new Date("2026-05-01T00:00:00Z");

describe("finance-lite", () => {
  let classroomId: number;
  let dingding: number;
  let sean: number;
  let T: number;
  let K: number;
  let outsideTeacher: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    dingding = classroom.ownerId;
    sean = (await createMember(classroomId, { email: "sean@test.local", name: "Sean", role: "admin" })).id;
    auth.classroomId = classroomId;
    auth.userId = dingding;

    T = (await createLocation(classroomId, { name: "台南", sortOrder: 0 })).id;
    K = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
    await prisma.location.update({ where: { id: T }, data: { keeperUserId: dingding, financeStartAt: START } });
    await prisma.location.update({ where: { id: K }, data: { keeperUserId: sean, financeStartAt: START } });
    outsideTeacher = (await prisma.teacher.create({ data: { classroomId, name: "外師", kind: "TEACHER" } })).id;
  });

  const specRule = () => ({
    lines: [
      { kind: "fixed", amount: 1000, to: { type: "teacher", teacherId: outsideTeacher } },
      { kind: "percent", pct: 10, base: "income", to: { type: "lessonFund" } },
    ],
    rest: { type: "holder" },
  });

  /** 台南的課：A、B、C 卡錢在台南、D、E、F 卡錢在高雄，每格 $300。 */
  async function setupSpecLesson({ startTime = new Date("2026-06-01T10:00:00Z") } = {}) {
    const card = await createCard(classroomId, { name: "6 堂卡" });
    const { lesson } = await createLesson(classroomId, { locationId: T });
    const period = await prisma.lessonPeriod.create({
      data: { lessonId: lesson.id, startTime, endTime: new Date(startTime.getTime() + 3600_000), attendanceTakenAt: new Date() },
    });
    await setLessonRule(classroomId, lesson.id, specRule(), dingding);
    const cards: Awaited<ReturnType<typeof createStudentCard>>[] = [];
    for (const [i, loc] of [T, T, T, K, K, K].entries()) {
      const student = await createStudent(classroomId, { name: "ABCDEF"[i] });
      const sc = await createStudentCard(student.id, card.id, { finalPrice: 1800, totalSessions: 6, remainingSessions: 5 });
      await prisma.studentCard.update({ where: { id: sc.id }, data: { moneyLocationId: loc, homeLocationId: T } });
      await prisma.attendanceRecord.create({
        data: { lessonPeriodId: period.id, studentId: student.id, studentCardId: sc.id },
      });
      cards.push(sc);
    }
    return { card, lesson, period, cards };
  }

  it("規格書例子：收入 1800，外師 1000、台南公積金 180，高雄欠台南 590", async () => {
    const { period } = await setupSpecLesson();
    const f = await getPeriodFinance(classroomId, period.id);

    expect(f.counted).toBe(true);
    expect(f.income).toBe(1800);
    expect(f.piles).toEqual(expect.arrayContaining([{ locationId: T, income: 900 }, { locationId: K, income: 900 }]));
    expect(f.flows).toEqual(
      expect.arrayContaining([
        { from: K, to: T, amount: 500, reason: "teacher" },
        { from: K, to: T, amount: 90, reason: "fund" },
      ])
    );
    expect(f.branchIncome).toEqual(expect.arrayContaining([{ locationId: T, amount: 490 }, { locationId: K, amount: 310 }]));
    expect(f.warnings).toEqual([]);
    expect(f.defaultPayerUserId).toBe(dingding);
  });

  it("結清後才進往來；轉帳轉平；取消結清就消失", async () => {
    const { period } = await setupSpecLesson();
    expect((await getBalances(classroomId)).pairs).toEqual([]);
    expect(await listUnsettledPeriods(classroomId)).toHaveLength(1);

    await settlePeriod(classroomId, period.id, { actorUserId: dingding });
    expect((await getBalances(classroomId)).pairs).toEqual([{ from: K, to: T, amount: 590 }]);
    expect(await listUnsettledPeriods(classroomId)).toHaveLength(0);

    await prisma.branchTransfer.create({
      data: { classroomId, fromLocationId: K, toLocationId: T, amount: 590, at: new Date(), createdById: sean },
    });
    const after = await getBalances(classroomId);
    expect(after.pairs).toEqual([]);
    expect(after.entries.map((e) => e.kind).sort()).toEqual(["period", "transfer"]);

    await prisma.branchTransfer.deleteMany({});
    await unsettlePeriod(classroomId, period.id);
    expect((await getBalances(classroomId)).pairs).toEqual([]);
  });

  it("Sean 在台南付外師：台南欠高雄 500，高雄欠台南 90 → 淨額台南欠高雄 410", async () => {
    const { period } = await setupSpecLesson();
    const f = await settlePeriod(classroomId, period.id, { actorUserId: dingding, paidByUserId: sean });
    expect(f.settlement).toMatchObject({ paidByUserId: sean, payerLocationId: K });
    expect((await getBalances(classroomId)).pairs).toEqual([{ from: T, to: K, amount: 410 }]);
  });

  it("付款人不是分部負責人 → 400", async () => {
    const { period } = await setupSpecLesson();
    const helper = await createMember(classroomId, { email: "h@test.local" });
    await expect(settlePeriod(classroomId, period.id, { actorUserId: dingding, paidByUserId: helper.id })).rejects.toMatchObject({
      code: "PAYER_NOT_KEEPER",
    });
  });

  it("結清後改點名不會改快照，但會標 changed；重複結清 409", async () => {
    const { period, card } = await setupSpecLesson();
    await settlePeriod(classroomId, period.id, { actorUserId: dingding });
    await expect(settlePeriod(classroomId, period.id, { actorUserId: dingding })).rejects.toMatchObject({ code: "ALREADY_SETTLED" });

    const g = await createStudent(classroomId, { name: "G" });
    const sc = await createStudentCard(g.id, card.id, { finalPrice: 1800, totalSessions: 6 });
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId: g.id, studentCardId: sc.id } });

    const f = await getPeriodFinance(classroomId, period.id);
    expect(f.income).toBe(1800);
    expect(f.settlement?.changed).toBe(true);
  });

  it("已結清的時段不能刪", async () => {
    const { lesson, period } = await setupSpecLesson();
    await settlePeriod(classroomId, period.id, { actorUserId: dingding });
    const res = await deletePeriod(jsonRequest("DELETE"), routeParams({ id: String(lesson.id), periodId: String(period.id) }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PERIOD_SETTLED");
  });

  it("轉換日前的課不算錢、不能結清", async () => {
    const { period } = await setupSpecLesson({ startTime: new Date("2026-04-20T10:00:00Z") });
    const f = await getPeriodFinance(classroomId, period.id);
    expect(f.counted).toBe(false);
    expect(f.warnings).toContain("NOT_STARTED");
    await expect(settlePeriod(classroomId, period.id, { actorUserId: dingding })).rejects.toMatchObject({ code: "NOT_STARTED" });
    expect(await listUnsettledPeriods(classroomId)).toHaveLength(0);
  });

  it("提醒：沒卡、卡未付、單堂未付、卡沒分部、沒規則", async () => {
    const { lesson, period, cards } = await setupSpecLesson();
    await prisma.lessonSplitRule.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.studentCard.update({ where: { id: cards[0].id }, data: { isPaid: false } });
    await prisma.studentCard.update({ where: { id: cards[1].id }, data: { moneyLocationId: null } });
    const noCard = await createStudent(classroomId, { name: "沒卡" });
    await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId: noCard.id } });
    const dropper = await createStudent(classroomId, { name: "單堂" });
    const rec = await prisma.attendanceRecord.create({ data: { lessonPeriodId: period.id, studentId: dropper.id } });
    await prisma.dropInCharge.create({ data: { attendanceRecordId: rec.id, amount: 500, isPaid: false } });

    const f = await getPeriodFinance(classroomId, period.id);
    expect(new Set(f.warnings)).toEqual(new Set(["NO_RULE", "CARD_UNPAID", "CARD_NO_BRANCH", "NO_CARD", "DROPIN_UNPAID"]));
    // 單堂算開課分部，卡沒分部也先算開課分部
    expect(f.piles).toEqual(expect.arrayContaining([{ locationId: T, income: 1400 }, { locationId: K, income: 900 }]));
    // 沒規則：全部留給卡錢的分部，沒有往來
    expect(f.flows).toEqual([]);
  });

  it("單堂覆寫蓋過整門課的規則", async () => {
    const { lesson, period } = await setupSpecLesson();
    await setPeriodOverride(classroomId, lesson.id, period.id, { lines: [], rest: { type: "lessonFund" } }, dingding);
    const f = await getPeriodFinance(classroomId, period.id);
    expect(f.ruleSource).toBe("override");
    expect(f.flows).toEqual([{ from: K, to: T, amount: 900, reason: "fund" }]);
  });

  it("次數包：場地費欠買包的分部，用完換下一包", async () => {
    const venue = await prisma.venue.create({ data: { classroomId, name: "高雄教室", locationId: K } });
    const pack1 = await prisma.venuePack.create({
      data: { classroomId, venueId: venue.id, sessions: 10, price: 4000, remainingAtStart: 1, paidByUserId: sean, purchasedAt: new Date("2026-01-01"), createdById: sean },
    });
    const pack2 = await prisma.venuePack.create({
      data: { classroomId, venueId: venue.id, sessions: 10, price: 5000, paidByUserId: sean, purchasedAt: new Date("2026-05-10"), createdById: sean },
    });
    const { lesson, period } = await setupSpecLesson();
    await setLessonRule(classroomId, lesson.id, { lines: [{ kind: "venuePack", venueId: venue.id }], rest: { type: "holder" } }, dingding);

    const first = await settlePeriod(classroomId, period.id, { actorUserId: dingding });
    expect(first.allocations[0]).toMatchObject({ amount: 400, payee: { type: "venue", packId: pack1.id } });
    // 台南那堆（一半）欠高雄 200
    expect(first.flows).toEqual([{ from: T, to: K, amount: 200, reason: "venue" }]);

    const p2 = await prisma.lessonPeriod.create({
      data: { lessonId: lesson.id, startTime: new Date("2026-06-08T10:00:00Z"), endTime: new Date("2026-06-08T11:00:00Z"), attendanceTakenAt: new Date() },
    });
    const second = await getPeriodFinance(classroomId, p2.id);
    expect(second.allocations[0]).toMatchObject({ amount: 500, payee: { type: "venue", packId: pack2.id } });
  });

  it("卡到期：錢在高雄、卡屬台南 → 高雄欠台南剩餘價值；轉換走的不算", async () => {
    const card = await createCard(classroomId, { name: "6 堂卡" });
    const s = await createStudent(classroomId, { name: "舊生" });
    const old = await createStudentCard(s.id, card.id, { finalPrice: 1800, totalSessions: 6, remainingSessions: 3 });
    await prisma.studentCard.update({
      where: { id: old.id },
      data: { moneyLocationId: K, homeLocationId: T, expiredAt: new Date("2026-06-15") },
    });
    const before = await createStudentCard(s.id, card.id, { finalPrice: 1800, totalSessions: 6, remainingSessions: 2 });
    await prisma.studentCard.update({
      where: { id: before.id },
      data: { moneyLocationId: K, homeLocationId: T, expiredAt: new Date("2026-04-15") },
    });

    const { pairs, entries } = await getBalances(classroomId);
    expect(pairs).toEqual([{ from: K, to: T, amount: 900 }]);
    expect(entries[0]).toMatchObject({ kind: "breakage", studentCardId: old.id, remainingSessions: 3 });

    // 轉換：舊卡停用但價值跟著新卡走，新卡沿用分部
    const live = await createStudentCard(s.id, card.id, { finalPrice: 1800, totalSessions: 6, remainingSessions: 4 });
    await prisma.studentCard.update({ where: { id: live.id }, data: { moneyLocationId: K, homeLocationId: T } });
    const target = await createCard(classroomId, { name: "新卡" });
    const sourceCard = await prisma.studentCard.findUniqueOrThrow({ where: { id: live.id }, include: { card: true } });
    const converted = await performConversion({
      sourceCard,
      targetCard: { id: target.id, name: target.name, price: target.price, classroomId },
      sessions: 4,
      actorUserId: dingding,
    });
    expect(converted).toMatchObject({ moneyLocationId: K, homeLocationId: T });
    expect((await getBalances(classroomId)).pairs).toEqual([{ from: K, to: T, amount: 900 }]);
  });

  it("在課堂上買卡：卡的分部預設是那堂課的分部", async () => {
    const card = await createCard(classroomId, { name: "6 堂卡" });
    const { lesson } = await createLesson(classroomId, { locationId: K });
    const s = await createStudent(classroomId);
    const res = await buyCard(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1800, isPaid: true, lessonId: lesson.id }),
      routeParams({ id: String(s.id) })
    );
    expect(res.status).toBe(200);
    const created = await prisma.studentCard.findFirstOrThrow({ where: { studentId: s.id } });
    expect(created).toMatchObject({ moneyLocationId: K, homeLocationId: K });
  });

  it("不在課堂上買卡：收款人是台南負責人 → 台南", async () => {
    const card = await createCard(classroomId, { name: "6 堂卡" });
    const s = await createStudent(classroomId);
    await buyCard(jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1800, isPaid: true }), routeParams({ id: String(s.id) }));
    const created = await prisma.studentCard.findFirstOrThrow({ where: { studentId: s.id } });
    expect(created).toMatchObject({ moneyLocationId: T, homeLocationId: T });
  });

  it("規則裡的老師要是這個教室的", async () => {
    const { lesson } = await createLesson(classroomId, { locationId: T });
    const other = await createClassroom({ name: "別人", email: "x@test.local" });
    const foreign = await prisma.teacher.create({ data: { classroomId: other.id, name: "別人的老師", kind: "TEACHER" } });
    await expect(
      setLessonRule(
        classroomId,
        lesson.id,
        { lines: [{ kind: "fixed", amount: 1, to: { type: "teacher", teacherId: foreign.id } }], rest: { type: "holder" } },
        dingding
      )
    ).rejects.toMatchObject({ code: "RULE_BAD_REFERENCE" });
  });
});
