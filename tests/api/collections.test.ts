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
  createPendingAttendance,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({ decodeAuthToken: async () => auth }));

import { GET } from "@/app/api/student-cards/collections/route";
import { toTaipeiDateKey } from "@/lib/taipei-date";

const get = async (date: string) =>
  (await GET(new Request(`http://test.local/api/student-cards/collections?date=${date}`), {
    params: Promise.resolve({}),
  })).json();

describe("GET /api/student-cards/collections（下課對帳）", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("依收款人 × 方式加總當天收的錢；列出今天有來、還欠款的學生", async () => {
    const teacher = await createMember(classroomId, { email: "t@test.local", name: "林老師" });
    const card = await createCard(classroomId);
    const today = new Date();
    const key = toTaipeiDateKey(today);

    const s1 = await createStudent(classroomId, { name: "A" });
    const s2 = await createStudent(classroomId, { name: "B" });
    const pay = async (studentId: number, price: number, by: number, method: "CASH" | "TRANSFER", at = today) => {
      const sc = await createStudentCard(studentId, card.id, { finalPrice: price, isPaid: false });
      await prisma.studentCard.update({
        where: { id: sc.id },
        data: { isPaid: true, paidAt: at, paidByUserId: by, paymentMethod: method },
      });
    };
    await pay(s1.id, 400, 1, "CASH");
    await pay(s2.id, 2400, 1, "CASH");
    await pay(s2.id, 2000, teacher.id, "TRANSFER");
    await pay(s2.id, 999, 1, "CASH", new Date(today.getTime() - 3 * 86_400_000)); // 別天

    const owes = await createStudent(classroomId, { name: "欠款且今天有來" });
    await createStudentCard(owes.id, card.id, { isPaid: false, finalPrice: 2000 });
    const absentOwes = await createStudent(classroomId, { name: "欠款但今天沒來" });
    await createStudentCard(absentOwes.id, card.id, { isPaid: false });
    const { period } = await createLesson(classroomId, { withPeriod: true });
    await prisma.lessonPeriod.update({ where: { id: period!.id }, data: { startTime: today } });
    await createPendingAttendance(period!.id, owes.id);

    const body = await get(key);
    expect(body.collected).toEqual([
      { receiverUserId: 1, receiverName: expect.any(String), paymentMethod: "CASH", total: 2800, count: 2 },
      { receiverUserId: teacher.id, receiverName: "林老師", paymentMethod: "TRANSFER", total: 2000, count: 1 },
    ]);
    expect(body.unpaid.map((u: { student: { name: string } }) => u.student.name)).toEqual(["欠款且今天有來"]);
  });

  it("當天收的單堂費也算進收到的錢，跟課卡併成同一位收款人 × 方式；沒收的、別天收的不算", async () => {
    const card = await createCard(classroomId);
    const today = new Date();
    const key = toTaipeiDateKey(today);
    const { period } = await createLesson(classroomId, { withPeriod: true });
    await prisma.lessonPeriod.update({ where: { id: period!.id }, data: { startTime: today } });

    const buyer = await createStudent(classroomId, { name: "買卡" });
    const sc = await createStudentCard(buyer.id, card.id, { finalPrice: 2000, isPaid: false });
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { isPaid: true, paidAt: today, paidByUserId: 1, paymentMethod: "CASH" },
    });

    const dropIn = async (
      name: string,
      amount: number,
      paid: { at: Date; method: "CASH" | "TRANSFER" } | null
    ) => {
      const student = await createStudent(classroomId, { name });
      await prisma.attendanceRecord.create({
        data: {
          lessonPeriodId: period!.id,
          studentId: student.id,
          dropInCharge: {
            create: paid
              ? { amount, isPaid: true, paidAt: paid.at, paidByUserId: 1, paymentMethod: paid.method }
              : { amount },
          },
        },
      });
    };
    await dropIn("單堂現金", 400, { at: today, method: "CASH" });
    await dropIn("單堂轉帳", 350, { at: today, method: "TRANSFER" });
    await dropIn("單堂還沒付", 400, null);
    await dropIn("單堂三天前付", 400, { at: new Date(today.getTime() - 3 * 86_400_000), method: "CASH" });

    const body = await get(key);
    expect(body.collected).toEqual([
      { receiverUserId: 1, receiverName: expect.any(String), paymentMethod: "CASH", total: 2400, count: 2 },
      { receiverUserId: 1, receiverName: expect.any(String), paymentMethod: "TRANSFER", total: 350, count: 1 },
    ]);
    expect(body).toMatchObject({ collectedTotal: 2750, collectedCount: 3 });
  });

  it("日期格式錯 → 400", async () => {
    const res = await GET(new Request("http://test.local/api/student-cards/collections?date=10/29"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });
});
