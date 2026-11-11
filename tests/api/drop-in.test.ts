import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createLesson,
  createStudentCard,
  createPendingAttendance,
  jsonRequest,
  routeParams,
} from "../factories";

// 單堂付費：出席不扣卡、記一筆 DropInCharge（src/service/dropIn.ts）。
const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
  readAuthSession: async () => auth,
}));

import { POST as chargeRoute } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/[studentId]/drop-in/route";
import { POST as confirmRoute } from "@/app/api/drop-in-charges/[id]/confirm-payment/route";
import { GET as getAttendance } from "@/app/api/lessons/[id]/periods/[periodId]/attendance/route";
import { POST as resetAttendance } from "@/app/api/lessons/[id]/periods/[periodId]/reset/route";
import { selfCheckIn, updateAttendance, takeAttendance } from "@/domains/attendance/attendance.service";
import { getTodos } from "@/service/todos";
import { periodRevenue } from "@/lib/income";
import { lessonDropInOptions, resolveDropInInput } from "@/lib/dropInOptions";

describe("單堂付費", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
  });

  async function setup(dropInPrice: number | null = 900) {
    const card = await createCard(classroomId, { name: "6 堂卡" });
    const { lesson, period } = await createLesson(classroomId, { cardIds: [card.id], withPeriod: true });
    await prisma.lesson.update({ where: { id: lesson.id }, data: { dropInPrice } });
    const student = await createStudent(classroomId);
    return { card, lesson, period: period!, student };
  }

  const charge = (lessonId: number, periodId: number, studentId: number, body: object) =>
    chargeRoute(
      jsonRequest("POST", body),
      routeParams({ id: String(lessonId), periodId: String(periodId), studentId: String(studentId) })
    );

  it("沒卡的出席改付單堂：記金額、不扣卡、不再算待處理的沒綁卡", async () => {
    const { lesson, period, student } = await setup();
    await createPendingAttendance(period.id, student.id);

    const res = await charge(lesson.id, period.id, student.id, { isPaid: true, paymentMethod: "CASH" });
    expect(res.status).toBe(200);

    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { studentId: student.id },
      include: { dropInCharge: true },
    });
    expect(record.studentCardId).toBeNull();
    expect(record.dropInCharge).toMatchObject({ amount: 900, isPaid: true, paymentMethod: "CASH", paidByUserId: auth.userId });

    const todos = await getTodos(classroomId);
    expect(todos.unboundAttendance).toHaveLength(0);
    expect(todos.unpaidDropIns).toHaveLength(0);

    const rows = await (
      await getAttendance(new Request("http://t"), routeParams({ id: String(lesson.id), periodId: String(period.id) }))
    ).json();
    expect(rows[0]).toMatchObject({ dropIn: { amount: 900, isPaid: true }, income: 900 });
    expect(rows[0].uncheckedType).toBeUndefined();
  });

  it("下課再付：進待處理，確認收款後消失", async () => {
    const { lesson, period, student } = await setup();
    await createPendingAttendance(period.id, student.id);
    await charge(lesson.id, period.id, student.id, { isPaid: false });

    const before = await getTodos(classroomId);
    expect(before.unpaidDropIns).toHaveLength(1);
    expect(before.urgentCount).toBe(1);

    const res = await confirmRoute(
      jsonRequest("POST", { paymentMethod: "TRANSFER", paymentReference: "12345" }),
      routeParams({ id: String(before.unpaidDropIns[0].id) })
    );
    expect(res.status).toBe(200);
    expect((await getTodos(classroomId)).unpaidDropIns).toHaveLength(0);
  });

  it("改價：實收照老師填的金額，動態標原價，營收算實收", async () => {
    const { lesson, period, student } = await setup();
    await createPendingAttendance(period.id, student.id);

    const res = await charge(lesson.id, period.id, student.id, { amount: 500, isPaid: true, paymentMethod: "CASH" });
    expect(res.status).toBe(200);

    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { studentId: student.id },
      include: { dropInCharge: true },
    });
    expect(record.dropInCharge).toMatchObject({ amount: 500, isPaid: true });
    const event = await prisma.event.findFirstOrThrow({ where: { studentId: student.id, title: "單堂付費" } });
    expect(event.description).toContain("$500（原價 $900）");

    const rows = await (
      await getAttendance(new Request("http://t"), routeParams({ id: String(lesson.id), periodId: String(period.id) }))
    ).json();
    expect(rows[0]).toMatchObject({ dropIn: { amount: 500 }, income: 500 });
  });

  it("確認收款時改價（學生在 LINE 選單堂記的是牌價）", async () => {
    const { lesson, period, student } = await setup();
    await createPendingAttendance(period.id, student.id);
    await charge(lesson.id, period.id, student.id, { isPaid: false });
    const [unpaid] = (await getTodos(classroomId)).unpaidDropIns;

    const res = await confirmRoute(
      jsonRequest("POST", { amount: 500, paymentMethod: "CASH" }),
      routeParams({ id: String(unpaid.id) })
    );
    expect(res.status).toBe(200);
    expect(await prisma.dropInCharge.findUniqueOrThrow({ where: { id: unpaid.id } })).toMatchObject({
      amount: 500,
      isPaid: true,
      paymentMethod: "CASH",
    });
  });

  it("金額不能是負數", async () => {
    const { lesson, period, student } = await setup();
    await createPendingAttendance(period.id, student.id);
    expect((await charge(lesson.id, period.id, student.id, { amount: -100, isPaid: true })).status).toBe(400);
    expect(await prisma.dropInCharge.count()).toBe(0);
  });

  it("沒開放單堂、或已綁卡的出席不能改單堂", async () => {
    const closed = await setup(null);
    await createPendingAttendance(closed.period.id, closed.student.id);
    expect((await charge(closed.lesson.id, closed.period.id, closed.student.id, { isPaid: true })).status).toBe(400);

    const { card, lesson, period } = await setup();
    const other = await createStudent(classroomId, { name: "有卡" });
    await createStudentCard(other.id, card.id);
    await takeAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [other.id] });
    expect((await charge(lesson.id, period.id, other.id, { isPaid: true })).status).toBe(400);
  });

  it("取消勾選、重設時段時單堂費跟著刪掉", async () => {
    const { lesson, period, student } = await setup();
    await createPendingAttendance(period.id, student.id);
    await charge(lesson.id, period.id, student.id, { isPaid: false });
    await updateAttendance({ lessonId: lesson.id, lessonPeriodId: period.id, studentIds: [] });
    expect(await prisma.dropInCharge.count()).toBe(0);

    await createPendingAttendance(period.id, student.id);
    await charge(lesson.id, period.id, student.id, { isPaid: true });
    await resetAttendance(new Request("http://t"), routeParams({ id: String(lesson.id), periodId: String(period.id) }));
    expect(await prisma.dropInCharge.count()).toBe(0);
  });

  it("LINE 自助簽到選單堂：不扣卡、記未付，requireCard 也放行", async () => {
    const { lesson, period, student } = await setup();
    const { results, dropInDue } = await selfCheckIn({
      studentId: student.id,
      lessonId: lesson.id,
      lessonPeriodIds: [period.id],
      card: { dropIn: true },
      requireCard: true,
    });
    expect(results[0]).toMatchObject({ status: "drop_in", dropInAmount: 900 });
    expect(dropInDue).toBe(900);
    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { studentId: student.id },
      include: { dropInCharge: true },
    });
    expect(record.dropInCharge).toMatchObject({ amount: 900, isPaid: false });
  });

  it("沒開放單堂的課，自助簽到選單堂被拒", async () => {
    const { lesson, period, student } = await setup(null);
    await expect(
      selfCheckIn({ studentId: student.id, lessonId: lesson.id, lessonPeriodIds: [period.id], card: { dropIn: true }, requireCard: true })
    ).rejects.toMatchObject({ code: "drop_in_not_offered" });
  });

  describe("單堂方案（多個價格）", () => {
    const PLANS = [
      { name: "原價", price: 500 },
      { name: "複習價", price: 250, note: "限上過 1-3 期的同學" },
    ];

    async function setupPlans() {
      const ctx = await setup(500);
      await prisma.lesson.update({ where: { id: ctx.lesson.id }, data: { dropInOptions: PLANS } });
      return ctx;
    }

    it("lessonDropInOptions：沒開放 = []、單一價 = 一個沒名字的、有方案照回", () => {
      expect(lessonDropInOptions({ dropInPrice: null, dropInOptions: PLANS })).toEqual([]);
      expect(lessonDropInOptions({ dropInPrice: 900, dropInOptions: null })).toEqual([{ name: "", price: 900 }]);
      expect(lessonDropInOptions({ dropInPrice: 500, dropInOptions: PLANS })).toEqual(PLANS);
    });

    it("resolveDropInInput：方案決定 dropInPrice；只給價錢會清掉方案；不合法擋掉", () => {
      expect(resolveDropInInput({ dropInPrice: 999, dropInOptions: PLANS })).toEqual({
        dropInPrice: 500,
        dropInOptions: PLANS,
      });
      expect(resolveDropInInput({ dropInPrice: 300 })).toEqual({ dropInPrice: 300, dropInOptions: null });
      expect(resolveDropInInput({ dropInPrice: null, dropInOptions: PLANS })).toEqual({
        dropInPrice: null,
        dropInOptions: null,
      });
      expect(resolveDropInInput({})).toEqual({});
      const dup = [{ name: "A", price: 1 }, { name: "A", price: 2 }];
      expect(resolveDropInInput({ dropInPrice: 1, dropInOptions: dup })).toBe("invalid");
      expect(resolveDropInInput({ dropInPrice: 1, dropInOptions: [{ name: " ", price: 1 }] })).toBe("invalid");
      const five = [1, 2, 3, 4, 5].map((n) => ({ name: `方案${n}`, price: n }));
      expect(resolveDropInInput({ dropInPrice: 1, dropInOptions: five })).toBe("invalid");
    });

    it("自助簽到選方案：記那個方案的價錢和名稱；沒指定 = 第一個", async () => {
      const { lesson, period, student } = await setupPlans();
      const { results, dropInDue } = await selfCheckIn({
        studentId: student.id,
        lessonId: lesson.id,
        lessonPeriodIds: [period.id],
        card: { dropIn: true, optionName: "複習價" },
        requireCard: true,
      });
      expect(results[0]).toMatchObject({ status: "drop_in", dropInAmount: 250, dropInOptionName: "複習價" });
      expect(dropInDue).toBe(250);
      const charge = await prisma.dropInCharge.findFirstOrThrow();
      expect(charge).toMatchObject({ amount: 250, optionName: "複習價", isPaid: false });

      const other = await createStudent(classroomId);
      await selfCheckIn({
        studentId: other.id,
        lessonId: lesson.id,
        lessonPeriodIds: [period.id],
        card: { dropIn: true },
        requireCard: true,
      });
      const second = await prisma.dropInCharge.findFirstOrThrow({
        where: { attendanceRecord: { studentId: other.id } },
      });
      expect(second).toMatchObject({ amount: 500, optionName: "原價" });

      const todos = await getTodos(classroomId);
      expect(todos.unpaidDropIns.map((t) => t.optionName).sort()).toEqual(["原價", "複習價"]);
    });

    it("自助簽到選不存在的方案：整筆拒絕、什麼都不寫", async () => {
      const { lesson, period, student } = await setupPlans();
      await expect(
        selfCheckIn({
          studentId: student.id,
          lessonId: lesson.id,
          lessonPeriodIds: [period.id],
          card: { dropIn: true, optionName: "員工價" },
          requireCard: true,
        })
      ).rejects.toMatchObject({ code: "drop_in_not_offered" });
      expect(await prisma.attendanceRecord.count()).toBe(0);
    });

    it("老師記單堂可以選方案；不存在的方案 400", async () => {
      const { lesson, period, student } = await setupPlans();
      await createPendingAttendance(period.id, student.id);
      const bad = await charge(lesson.id, period.id, student.id, { isPaid: false, optionName: "員工價" });
      expect(bad.status).toBe(400);
      const res = await charge(lesson.id, period.id, student.id, { isPaid: false, optionName: "複習價" });
      expect(res.status).toBe(200);
      expect(await prisma.dropInCharge.findFirstOrThrow()).toMatchObject({ amount: 250, optionName: "複習價" });
    });

    it("收款時換方案：金額跟著新方案；另外帶 amount 以 amount 為準", async () => {
      const { lesson, period, student } = await setupPlans();
      await selfCheckIn({
        studentId: student.id,
        lessonId: lesson.id,
        lessonPeriodIds: [period.id],
        card: { dropIn: true, optionName: "複習價" },
        requireCard: true,
      });
      const created = await prisma.dropInCharge.findFirstOrThrow();
      const res = await confirmRoute(
        jsonRequest("POST", { paymentMethod: "CASH", optionName: "原價" }),
        routeParams({ id: String(created.id) })
      );
      expect(res.status).toBe(200);
      expect(await prisma.dropInCharge.findFirstOrThrow()).toMatchObject({
        amount: 500,
        optionName: "原價",
        isPaid: true,
      });
    });

    it("改課程的方案不動已經記的帳", async () => {
      const { lesson, period, student } = await setupPlans();
      await selfCheckIn({
        studentId: student.id,
        lessonId: lesson.id,
        lessonPeriodIds: [period.id],
        card: { dropIn: true, optionName: "複習價" },
        requireCard: true,
      });
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { dropInPrice: 600, dropInOptions: [{ name: "新價", price: 600 }] },
      });
      const created = await prisma.dropInCharge.findFirstOrThrow();
      expect(created).toMatchObject({ amount: 250, optionName: "複習價" });
      // 沒換方案的收款照舊能過（舊方案名稱已經不在課程上）。
      const res = await confirmRoute(
        jsonRequest("POST", { paymentMethod: "CASH" }),
        routeParams({ id: String(created.id) })
      );
      expect(res.status).toBe(200);
      expect(await prisma.dropInCharge.findFirstOrThrow()).toMatchObject({ amount: 250, optionName: "複習價" });
    });
  });

  it("營收算進單堂金額", () => {
    expect(periodRevenue([{ studentCard: null, dropInCharge: { amount: 900 } }])).toBe(900);
  });
});
