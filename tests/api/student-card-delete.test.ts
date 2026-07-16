import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { DELETE } from "@/app/api/students/[id]/student-cards/[studentCardId]/route";

describe("DELETE /api/students/[id]/student-cards/[studentCardId]", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("未使用過的課卡 → 成功刪除", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id);

    const res = await DELETE(
      jsonRequest("DELETE"),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(
      await prisma.studentCard.count({ where: { id: sc.id } })
    ).toBe(0);
  });

  it("已被簽到使用過的課卡 → 400（應改用過期，不可刪除）", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id);
    const { period } = await createLesson(classroomId, { withPeriod: true });
    await prisma.attendanceRecord.create({
      data: {
        lessonPeriodId: period!.id,
        studentId: student.id,
        studentCardId: sc.id,
      },
    });

    const res = await DELETE(
      jsonRequest("DELETE"),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/expire it instead/i);
    // 仍存在
    expect(await prisma.studentCard.count({ where: { id: sc.id } })).toBe(1);
  });

  it("卡片不存在 → 404", async () => {
    const student = await createStudent(classroomId);
    const res = await DELETE(
      jsonRequest("DELETE"),
      routeParams({ id: String(student.id), studentCardId: "9999" })
    );
    expect(res.status).toBe(404);
  });

  it("卡片不屬於該學生 → 400", async () => {
    const studentA = await createStudent(classroomId, { name: "A" });
    const studentB = await createStudent(classroomId, { name: "B" });
    const card = await createCard(classroomId);
    const scOfB = await createStudentCard(studentB.id, card.id);

    const res = await DELETE(
      jsonRequest("DELETE"),
      routeParams({ id: String(studentA.id), studentCardId: String(scOfB.id) })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/does not belong/i);
    expect(await prisma.studentCard.count({ where: { id: scOfB.id } })).toBe(1);
  });

  it("跨教室：刪除他人教室的課卡 → 404（不洩漏存在性、不改動）", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    const otherStudent = await createStudent(otherClassroom.id, { name: "別人" });
    const otherCard = await createCard(otherClassroom.id);
    const otherSc = await createStudentCard(otherStudent.id, otherCard.id);

    const res = await DELETE(
      jsonRequest("DELETE"),
      routeParams({
        id: String(otherStudent.id),
        studentCardId: String(otherSc.id),
      })
    );
    expect(res.status).toBe(404);
    expect(await prisma.studentCard.count({ where: { id: otherSc.id } })).toBe(1);
  });
});
