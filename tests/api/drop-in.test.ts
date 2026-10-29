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

  it("營收算進單堂金額", () => {
    expect(periodRevenue([{ studentCard: null, dropInCharge: { amount: 900 } }])).toBe(900);
  });
});
