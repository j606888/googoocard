import { describe, it, expect, beforeEach, vi } from "vitest";
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

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { PATCH } from "@/app/api/students/[id]/student-cards/[studentCardId]/route";

function patchNote(studentId: number, studentCardId: number, note: unknown) {
  return PATCH(
    jsonRequest("PATCH", { note }),
    routeParams({ id: String(studentId), studentCardId: String(studentCardId) })
  );
}

describe("PATCH /api/students/[id]/student-cards/[studentCardId]", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("寫入備註並去除前後空白", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id);

    const res = await patchNote(student.id, sc.id, "  已轉換為 Level 2 卡  ");
    expect(res.status).toBe(200);
    expect((await res.json()).note).toBe("已轉換為 Level 2 卡");
  });

  it("空字串與 null 都清除備註", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id, { note: "舊備註" });

    expect((await (await patchNote(student.id, sc.id, "   ")).json()).note).toBeNull();

    await prisma.studentCard.update({ where: { id: sc.id }, data: { note: "又寫回來" } });
    expect((await (await patchNote(student.id, sc.id, null)).json()).note).toBeNull();
  });

  it("已停用的卡也能編輯備註", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id);
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { expiredAt: new Date() },
    });

    const res = await patchNote(student.id, sc.id, "停用原因：轉換");
    expect(res.status).toBe(200);
    expect((await res.json()).note).toBe("停用原因：轉換");
  });

  it("超過 500 字 → 400", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id);

    const res = await patchNote(student.id, sc.id, "字".repeat(501));
    expect(res.status).toBe(400);
  });

  it("非字串 → 400", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id);

    expect((await patchNote(student.id, sc.id, 123)).status).toBe(400);
  });

  it("跨教室 → 404，且不改動", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    const otherStudent = await createStudent(otherClassroom.id, { name: "別人" });
    const otherCard = await createCard(otherClassroom.id);
    const otherSc = await createStudentCard(otherStudent.id, otherCard.id);

    const res = await patchNote(otherStudent.id, otherSc.id, "偷改");
    expect(res.status).toBe(404);

    const untouched = await prisma.studentCard.findUniqueOrThrow({
      where: { id: otherSc.id },
    });
    expect(untouched.note).toBeNull();
  });

  it("卡片不屬於該學生 → 400", async () => {
    const studentA = await createStudent(classroomId, { name: "A" });
    const studentB = await createStudent(classroomId, { name: "B" });
    const card = await createCard(classroomId);
    const scOfB = await createStudentCard(studentB.id, card.id);

    const res = await patchNote(studentA.id, scOfB.id, "偷改");
    expect(res.status).toBe(400);
  });
});
