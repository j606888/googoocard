import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/students/[id]/student-cards/[studentCardId]/convert/route";

function convert(
  studentId: number,
  studentCardId: number,
  body: { targetCardId: number; sessions?: number; note?: string }
) {
  return POST(
    jsonRequest("POST", body),
    routeParams({ id: String(studentId), studentCardId: String(studentCardId) })
  );
}

describe("POST /api/students/[id]/student-cards/[studentCardId]/convert", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
  });

  it("等堂升級：新卡繼承剩餘堂數與剩餘價值，舊卡停用並連結", async () => {
    const student = await createStudent(classroomId);
    const level1 = await createCard(classroomId, { name: "Level 1", sessions: 6 });
    const level2 = await createCard(classroomId, { name: "Level 2", price: 4000, sessions: 6 });
    // 6 堂 3000 元 → 單堂 500，用掉 2 堂剩 4 堂 = 剩餘價值 2000
    const sc = await createStudentCard(student.id, level1.id, {
      totalSessions: 6,
      remainingSessions: 4,
      finalPrice: 3000,
    });

    const res = await convert(student.id, sc.id, { targetCardId: level2.id });
    expect(res.status).toBe(200);
    const created = await res.json();

    expect(created.cardId).toBe(level2.id);
    expect(created.origin).toBe("CONVERSION");
    expect(created.totalSessions).toBe(4);
    expect(created.remainingSessions).toBe(4);
    expect(created.finalPrice).toBe(2000);
    expect(created.basePrice).toBe(4000);
    // 沒有金流 → 直接視為已付清，不能落入未付款清單
    expect(created.isPaid).toBe(true);
    expect(created.paidAt).not.toBeNull();
    expect(created.note).toBe("由「Level 1」剩餘 4 堂轉換而來。");

    const old = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(old.expiredAt).not.toBeNull();
    expect(old.convertedToId).toBe(created.id);
    expect(old.remainingSessions).toBe(4); // 跟一般停用一致，不歸零
    expect(old.note).toBe("已轉換為「Level 2」4 堂（剩餘 4 堂），故停用。");
  });

  it("複習卡折抵：指定較少堂數，剩餘價值仍全額帶走", async () => {
    const student = await createStudent(classroomId, {
      qualifications: [DanceType.BACHATA],
    });
    const practice = await createCard(classroomId, {
      name: "複習卡",
      sessions: 3,
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });
    const level2 = await createCard(classroomId, { name: "Level 2", price: 4000 });
    // 3 堂 900 元，全新未使用 → 剩餘價值 900
    const sc = await createStudentCard(student.id, practice.id, {
      totalSessions: 3,
      remainingSessions: 3,
      finalPrice: 900,
    });

    const res = await convert(student.id, sc.id, {
      targetCardId: level2.id,
      sessions: 1,
    });
    expect(res.status).toBe(200);
    const created = await res.json();

    expect(created.totalSessions).toBe(1);
    expect(created.finalPrice).toBe(900);
    // 單堂價 900 — 3 堂的錢在 1 堂認列，整體營收守恆
  });

  it("自訂備註蓋掉預設文字", async () => {
    const student = await createStudent(classroomId);
    const from = await createCard(classroomId, { name: "舊卡" });
    const to = await createCard(classroomId, { name: "新卡" });
    const sc = await createStudentCard(student.id, from.id);

    const res = await convert(student.id, sc.id, {
      targetCardId: to.id,
      note: "老闆特批",
    });
    expect((await res.json()).note).toBe("老闆特批");
  });

  it("已有備註的舊卡：轉換說明用附加的，不覆蓋原本內容", async () => {
    const student = await createStudent(classroomId);
    const from = await createCard(classroomId, { name: "舊卡" });
    const to = await createCard(classroomId, { name: "新卡" });
    const sc = await createStudentCard(student.id, from.id, { note: "原本的備註" });

    await convert(student.id, sc.id, { targetCardId: to.id });

    const old = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(old.note?.startsWith("原本的備註\n")).toBe(true);
    expect(old.note).toContain("已轉換為「新卡」");
  });

  it("寫入 Event 供學生時間軸顯示", async () => {
    const student = await createStudent(classroomId);
    const from = await createCard(classroomId, { name: "Level 1" });
    const to = await createCard(classroomId, { name: "Level 2" });
    const sc = await createStudentCard(student.id, from.id, { remainingSessions: 2 });

    const created = await (await convert(student.id, sc.id, { targetCardId: to.id })).json();

    const event = await prisma.event.findFirstOrThrow({
      where: { studentId: student.id, title: "課卡轉換" },
    });
    expect(event.resourceId).toBe(created.id);
    expect(event.description).toContain("Level 1");
    expect(event.description).toContain("Level 2");
  });

  it("同一張卡不能轉換兩次 → 400", async () => {
    const student = await createStudent(classroomId);
    const from = await createCard(classroomId, { name: "舊卡" });
    const to = await createCard(classroomId, { name: "新卡" });
    const sc = await createStudentCard(student.id, from.id);

    expect((await convert(student.id, sc.id, { targetCardId: to.id })).status).toBe(200);

    const second = await convert(student.id, sc.id, { targetCardId: to.id });
    // 第一次轉換已把舊卡停用，所以這裡先被 expired 擋下
    expect(second.status).toBe(400);
    expect(await prisma.studentCard.count({ where: { studentId: student.id } })).toBe(2);
  });

  it("已停用的卡 → 400", async () => {
    const student = await createStudent(classroomId);
    const from = await createCard(classroomId);
    const to = await createCard(classroomId, { name: "新卡" });
    const sc = await createStudentCard(student.id, from.id);
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { expiredAt: new Date() },
    });

    const res = await convert(student.id, sc.id, { targetCardId: to.id });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already expired/i);
  });

  it("已用完(剩 0 堂)的卡 → 400，沒有價值可以帶走", async () => {
    const student = await createStudent(classroomId);
    const from = await createCard(classroomId);
    const to = await createCard(classroomId, { name: "新卡" });
    const sc = await createStudentCard(student.id, from.id, { remainingSessions: 0 });

    const res = await convert(student.id, sc.id, { targetCardId: to.id });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no remaining sessions/i);
  });

  it("轉換成複習卡但學生沒有該舞種資格 → 403，不能繞過購買限制", async () => {
    const student = await createStudent(classroomId); // 無資格
    const from = await createCard(classroomId, { name: "Level 1" });
    const practice = await createCard(classroomId, {
      name: "複習卡",
      isPracticeCard: true,
      danceType: DanceType.SALSA,
    });
    const sc = await createStudentCard(student.id, from.id);

    const res = await convert(student.id, sc.id, { targetCardId: practice.id });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("STUDENT_NOT_QUALIFIED");

    // 什麼都不該發生
    const untouched = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(untouched.expiredAt).toBeNull();
    expect(await prisma.studentCard.count({ where: { studentId: student.id } })).toBe(1);
  });

  it("目標卡屬於別的教室 → 404", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    const otherCard = await createCard(otherClassroom.id, { name: "別人的卡" });

    const student = await createStudent(classroomId);
    const from = await createCard(classroomId);
    const sc = await createStudentCard(student.id, from.id);

    const res = await convert(student.id, sc.id, { targetCardId: otherCard.id });
    expect(res.status).toBe(404);
  });

  it("跨教室：轉換他人教室的課卡 → 404，且不改動", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    const otherStudent = await createStudent(otherClassroom.id, { name: "別人" });
    const otherCard = await createCard(otherClassroom.id);
    const otherSc = await createStudentCard(otherStudent.id, otherCard.id);

    const to = await createCard(classroomId, { name: "新卡" });
    const res = await convert(otherStudent.id, otherSc.id, { targetCardId: to.id });
    expect(res.status).toBe(404);

    const untouched = await prisma.studentCard.findUniqueOrThrow({
      where: { id: otherSc.id },
    });
    expect(untouched.expiredAt).toBeNull();
  });

  it("卡片不屬於該學生 → 400", async () => {
    const studentA = await createStudent(classroomId, { name: "A" });
    const studentB = await createStudent(classroomId, { name: "B" });
    const from = await createCard(classroomId);
    const to = await createCard(classroomId, { name: "新卡" });
    const scOfB = await createStudentCard(studentB.id, from.id);

    const res = await convert(studentA.id, scOfB.id, { targetCardId: to.id });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/does not belong/i);
  });

  it("堂數不合法 → 400", async () => {
    const student = await createStudent(classroomId);
    const from = await createCard(classroomId);
    const to = await createCard(classroomId, { name: "新卡" });
    const sc = await createStudentCard(student.id, from.id);

    for (const sessions of [0, -1, 1.5]) {
      const res = await convert(student.id, sc.id, { targetCardId: to.id, sessions });
      expect(res.status).toBe(400);
    }
  });
});
