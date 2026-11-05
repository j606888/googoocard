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

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 as number | undefined }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as homeRoute } from "@/app/api/finance/home/route";
import { getMonthStatement } from "@/service/finance/settlement";
import { getFinanceHome } from "@/service/finance/home";
import { getTodos } from "@/service/todos";
import { monthWaterfall } from "@/domains/finance/waterfall";
import type { SplitRule } from "@/domains/finance/types";

// spec §14：十一月模擬（開帳都是 0）。L2 是週日課：在台南上、基金是高雄（spec「週日課」）。
const LAUNCH = new Date("2026-10-31T16:00:00Z"); // 2026-11-01 00:00 台北
const DEC_3 = new Date("2026-12-03T04:00:00Z");
const noParams = { params: Promise.resolve({}) };

describe("finance home", () => {
  let classroomId: number;
  let dingId: number;
  let seanId: number;
  let tainanId: number;
  let kaoId: number;
  let cardTypeId: number;
  let l6LessonId: number;
  let l2LessonId: number;
  let stepsId: number;

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

  async function newCard(holder: number | null, { sessions = 6, paid = true } = {}) {
    const student = await createStudent(classroomId, { name: `S${Math.random()}` });
    const sc = await createStudentCard(student.id, cardTypeId, {
      finalPrice: 2000, totalSessions: sessions, remainingSessions: sessions - 1, isPaid: paid,
    });
    if (holder !== null) await prisma.studentCard.update({ where: { id: sc.id }, data: { paidByUserId: holder } });
    return { studentId: student.id, cardId: sc.id };
  }

  async function attend(periodId: number, card: { studentId: number; cardId: number }) {
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: periodId, studentId: card.studentId, studentCardId: card.cardId, sessionsUsed: 1 },
    });
  }

  async function dropIn(periodId: number, amount: number, holder: number, isPaid = true) {
    const student = await createStudent(classroomId, { name: `D${Math.random()}` });
    const rec = await prisma.attendanceRecord.create({
      data: { lessonPeriodId: periodId, studentId: student.id, sessionsUsed: 1 },
    });
    await prisma.dropInCharge.create({
      data: { attendanceRecordId: rec.id, amount, isPaid, paidByUserId: isPaid ? holder : null, paidAt: isPaid ? new Date() : null },
    });
  }

  async function seed() {
    seanId = (await createMember(classroomId, { email: "s@test.local", name: "S", role: "admin" })).id;
    await prisma.membership.updateMany({ where: { classroomId }, data: { isCustodian: true, canSettle: true } });
    await enableFinanceFor(classroomId, { launch: LAUNCH });

    tainanId = (await createLocation(classroomId, { name: "台南" })).id;
    await prisma.location.update({ where: { id: tainanId }, data: { keeperUserId: dingId } });
    kaoId = (await createLocation(classroomId, { name: "高雄", sortOrder: 1 })).id;
    await prisma.location.update({ where: { id: kaoId }, data: { keeperUserId: seanId } });

    const tDing = (await createTeacher(classroomId, { name: "丁丁", userId: dingId })).id;
    const tSean = (await createTeacher(classroomId, { name: "Sean", userId: seanId })).id;
    const nora = (await createTeacher(classroomId, { name: "Nora", payerUserId: dingId })).id;
    const charlene = (await createTeacher(classroomId, { name: "Charlene", payerUserId: dingId })).id;
    const partner = (await createTeacher(classroomId, { name: "搭檔", payerUserId: seanId })).id;
    const home = (await createVenue(classroomId, { name: "Home", landlordUserId: dingId })).id;
    stepsId = (await createVenue(classroomId, { name: "24steps" })).id;
    cardTypeId = (await createCard(classroomId)).id;

    const rule = async (lessonId: number, r: SplitRule) =>
      prisma.lessonSplitRule.create({ data: { lessonId, rule: r, updatedById: dingId } });
    const third = 100 / 3;
    const tainanRule = (other: number): SplitRule => ({
      lines: [
        { kind: "percent", pct: third, base: "income", to: { type: "teacher", teacherId: tDing } },
        { kind: "percent", pct: third, base: "income", to: { type: "teacher", teacherId: other } },
        { kind: "fixed", amount: 300, to: { type: "venue", venueId: home } },
      ],
      rest: { type: "fund", locationId: tainanId },
      fundLocationId: tainanId,
    });

    const xiaoming = await newCard(dingId);
    const xiaohua = await newCard(dingId);
    const xiaomei = await newCard(dingId);
    const b1 = await newCard(dingId, { sessions: 5 });
    const b2 = await newCard(dingId, { sessions: 5 });

    // L1 週四期班（台南）：B1、B2 + 單堂 450 → 1250
    const l1 = (await createLesson(classroomId, { name: "L1", locationId: tainanId })).lesson;
    await rule(l1.id, tainanRule(nora));
    const p1 = await addPeriod(l1.id, "2026-11-05T11:00:00Z");
    await attend(p1.id, b1);
    await attend(p1.id, b2);
    await dropIn(p1.id, 450, dingId);

    // L2 週日（台南上課、基金高雄）：場地 300 → 房東丁丁，剩下 → Sean
    const l2 = (await createLesson(classroomId, { name: "L2", locationId: tainanId })).lesson;
    l2LessonId = l2.id;
    await rule(l2.id, {
      lines: [{ kind: "fixed", amount: 300, to: { type: "venue", venueId: home } }],
      rest: { type: "teachers", shares: [{ teacherId: tSean, weight: 1 }] },
      fundLocationId: kaoId,
    });
    const p2 = await addPeriod(l2.id, "2026-11-09T02:00:00Z");
    await attend(p2.id, xiaoming);
    await attend(p2.id, xiaohua);

    // L3 週二（台南）：三人 → 1000
    const l3 = (await createLesson(classroomId, { name: "L3", locationId: tainanId })).lesson;
    await rule(l3.id, tainanRule(charlene));
    const p3 = await addPeriod(l3.id, "2026-11-11T11:00:00Z");
    for (const c of [xiaoming, xiaohua, xiaomei]) await attend(p3.id, c);

    // L4 高雄：場地 405、10% 公積金、剩下 Sean／搭檔平分；小強（Sean）、小明（丁丁的卡）、單堂 350
    const l4 = (await createLesson(classroomId, { name: "L4", locationId: kaoId })).lesson;
    await rule(l4.id, {
      lines: [
        { kind: "fixed", amount: 405, to: { type: "venue", venueId: stepsId } },
        { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: kaoId } },
      ],
      rest: { type: "teachers", shares: [{ teacherId: tSean, weight: 1 }, { teacherId: partner, weight: 1 }] },
      fundLocationId: kaoId,
    });
    const p4 = await addPeriod(l4.id, "2026-11-12T10:00:00Z");
    await attend(p4.id, await newCard(seanId));
    await attend(p4.id, xiaoming);
    await dropIn(p4.id, 350, seanId);

    // L5 週四期班（台南）：B1 出席、B2 缺席（自動扣）→ 800
    const p5 = await addPeriod(l1.id, "2026-11-12T11:00:00Z");
    await attend(p5.id, b1);
    await prisma.attendanceAbsence.create({
      data: { lessonPeriodId: p5.id, studentId: b2.studentId, studentCardId: b2.cardId, sessionsUsed: 1 },
    });

    // L6 週二（台南）：三人，阿傑沒付
    const l6 = (await createLesson(classroomId, { name: "L6", locationId: tainanId })).lesson;
    l6LessonId = l6.id;
    await rule(l6.id, tainanRule(charlene));
    const p6 = await addPeriod(l6.id, "2026-11-26T11:00:00Z");
    for (const c of [xiaoming, xiaohua, xiaomei]) await attend(p6.id, c);
    await attend(p6.id, await newCard(null, { paid: false }));

    // 支出：台南 IG 廣告 500（丁丁）、高雄飲料 210（Sean）
    const expense = (locationId: number, amount: number, paidByUserId: number, date: string) =>
      prisma.financeExpense.create({
        data: { classroomId, date: new Date(date), amount, locationId, category: "其他", paidByUserId, createdById: dingId },
      });
    await expense(tainanId, 500, dingId, "2026-11-20T04:00:00Z");
    await expense(kaoId, 210, seanId, "2026-11-22T04:00:00Z");
  }

  describe("waterfall — spec §14", () => {
    it("台南：本月淨變化 = 公積金變化 −350", async () => {
      const s = await getMonthStatement(classroomId, "2026-11", DEC_3);
      const w = monthWaterfall(s, tainanId);
      expect(w.income).toBeCloseTo(1250 + 1000 + 800 + 1000, 2);
      expect(w.venues).toBeCloseTo(1200, 2);
      expect(w.fund).toBeCloseTo(116.67 + 33.33 - 33.33 + 33.33, 2);
      expect(w.expenses).toBe(500);
      expect(w.net).toBeCloseTo(-350, 2);
      expect(w.net).toBeCloseTo(s.byBranch.find((b) => b.locationId === tainanId)!.fundChange, 5);
    });

    it("高雄：週日課算高雄；本月淨變化 −148.83 再加取整零頭 = −148.66", async () => {
      const s = await getMonthStatement(classroomId, "2026-11", DEC_3);
      const w = monthWaterfall(s, kaoId);
      expect(w.income).toBeCloseTo(1683.33, 2);
      expect(w.lessons.map((l) => l.lessonId)).toContain(l2LessonId);
      expect(w.teachers).toBeCloseTo(366.67 + 550.5, 2);
      expect(w.venues).toBeCloseTo(705, 2);
      expect(w.fund).toBeCloseTo(61.17, 2);
      expect(w.expenses).toBe(210);
      // 搭檔 275.25 → 275（+0.25）、Sean 641.92 → 642（−0.08），零頭進高雄公積金
      expect(w.other).toBeCloseTo(0.17, 2);
      // spec 寫 −148.66（各項先四捨五入）；精確值 −148.8333 + 0.25 − 0.0833 = −148.6667
      expect(w.net).toBeCloseTo(-148.6667, 3);
      expect(w.net).toBeCloseTo(s.byBranch.find((b) => b.locationId === kaoId)!.fundChange, 5);
    });

    it("全教室 = 兩個分部加起來", async () => {
      const s = await getMonthStatement(classroomId, "2026-11", DEC_3);
      const all = monthWaterfall(s, "all");
      expect(all.income).toBeCloseTo(4050 + 1683.33, 1);
      expect(all.net).toBeCloseTo(-350 - 148.66, 1);
    });
  });

  describe("要處理的事", () => {
    it("reuses the todos lists; to-collect items go by where the class is held, others by the lesson's fund", async () => {
      const l1 = await prisma.lesson.findFirstOrThrow({ where: { classroomId, name: "L1" } });
      const p = await addPeriod(l2LessonId, "2026-11-16T02:00:00Z");
      await dropIn(p.id, 300, seanId, false);
      const unbound = await createStudent(classroomId, { name: "沒卡" });
      await prisma.attendanceRecord.create({ data: { lessonPeriodId: p.id, studentId: unbound.id, sessionsUsed: 1 } });
      await addPeriod(l1.id, "2026-11-19T11:00:00Z", false);

      // 還沒用過的未付款卡
      const unused = await newCard(null, { paid: false });
      // 先在高雄（L4）用、後來在台南用 → 算高雄
      const l4 = await prisma.lesson.findFirstOrThrow({ where: { classroomId, name: "L4" } });
      const travel = await newCard(null, { paid: false });
      await attend((await addPeriod(l1.id, "2026-11-26T11:00:00Z")).id, travel);
      await attend((await addPeriod(l4.id, "2026-11-12T11:00:00Z")).id, travel);

      const home = await getFinanceHome(classroomId, dingId, DEC_3);
      expect(home.myLocationId).toBe(tainanId);
      expect(home.branches.map((b) => b.id)).toEqual([tainanId, kaoId]);
      // 未付款的卡：第一次用的那堂課的上課地點；還沒用過 → null（每個分部都看得到）
      const cardLoc = Object.fromEntries(home.unpaidCards.map((c) => [c.id, c.locationId]));
      expect(Object.keys(cardLoc)).toHaveLength(3);
      expect(cardLoc[unused.cardId]).toBeNull();
      expect(cardLoc[travel.cardId]).toBe(kaoId);
      expect(Object.values(cardLoc).filter((v) => v === tainanId)).toHaveLength(1); // seed 那張在 L6（台南）用
      // 週日課的未付單堂、沒卡 → 台南（上課地點），不是這堂課的基金高雄
      expect(home.unpaidDropIns).toEqual([expect.objectContaining({ amount: 300, locationId: tainanId })]);
      expect(home.unboundAttendance).toEqual([expect.objectContaining({ lessonPeriodId: p.id, locationId: tainanId })]);
      expect(home.uncheckedPeriods).toEqual([expect.objectContaining({ lessonId: l1.id, locationId: tainanId })]);
      expect(home.unsettledMonth).toBe("2026-11");
    });

    it("只列上線日之後的時段：上線前的點名沒課卡、未付單堂不列（原本的待處理頁照列）", async () => {
      const l1 = await prisma.lesson.findFirstOrThrow({ where: { classroomId, name: "L1" } });
      const before = await addPeriod(l1.id, "2026-09-20T02:00:00Z");
      const after = await addPeriod(l1.id, "2026-11-16T02:00:00Z");
      const s = await createStudent(classroomId, { name: "小龍" });
      for (const p of [before, after]) {
        await prisma.attendanceRecord.create({ data: { lessonPeriodId: p.id, studentId: s.id, sessionsUsed: 1 } });
      }
      const early = await addPeriod(l1.id, "2026-10-31T15:00:00Z"); // 上線前一小時
      await dropIn(early.id, 300, seanId, false);
      await dropIn(after.id, 200, seanId, false);

      const home = await getFinanceHome(classroomId, dingId, DEC_3);
      expect(home.unboundAttendance.map((r) => r.lessonPeriodId)).toEqual([after.id]);
      expect(home.unpaidDropIns.map((d) => d.amount)).toEqual([200]);
      const todos = await getTodos(classroomId, DEC_3);
      expect(todos.unboundAttendance.map((r) => r.lessonPeriodId).sort()).toEqual([before.id, after.id].sort());
      expect(todos.unpaidDropIns).toHaveLength(2);
    });

    it("lessons without a split rule, used-up packs", async () => {
      const lesson = (await createLesson(classroomId, { name: "新課", locationId: kaoId })).lesson;
      // 次數包 1 次，被兩堂用掉 → 用完（超用 1 次）
      await createVenuePack(classroomId, stepsId, { sessions: 1, price: 405, paidByUserId: seanId, purchasedAt: LAUNCH });
      const l6Rule = await prisma.lessonSplitRule.findUniqueOrThrow({ where: { lessonId: l6LessonId } });
      const packRule = { ...(l6Rule.rule as SplitRule), lines: [{ kind: "venuePack", venueId: stepsId }] } as SplitRule;
      await prisma.lessonSplitRule.update({ where: { lessonId: l6LessonId }, data: { rule: packRule } });
      await addPeriod(l6LessonId, "2026-11-27T11:00:00Z");

      const home = await getFinanceHome(classroomId, seanId, DEC_3);
      expect(home.myLocationId).toBe(kaoId);
      expect(home.unsplitLessons).toEqual([{ lessonId: lesson.id, lessonName: "新課", locationId: kaoId }]);
      expect(home.exhaustedPacks).toEqual([expect.objectContaining({ venueId: stepsId, venueName: "24steps", overdrawn: 1 })]);
    });

    it("route: any member can read; 404 when finance is off", async () => {
      const res = await homeRoute(new Request("http://test.local/api/finance/home"), noParams);
      expect(res.status).toBe(200);
      await prisma.classroom.update({ where: { id: classroomId }, data: { financeEnabledAt: null } });
      const off = await homeRoute(new Request("http://test.local/api/finance/home"), noParams);
      expect(off.status).toBe(404);
    });
  });
});
