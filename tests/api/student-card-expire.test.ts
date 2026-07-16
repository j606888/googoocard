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

import { POST } from "@/app/api/students/[id]/student-cards/[studentCardId]/expire/route";

describe("POST /api/students/[id]/student-cards/[studentCardId]/expire", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("成功過期 → 設定 expiredAt、回 success", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id, {
      remainingSessions: 3,
    });

    const res = await POST(
      jsonRequest("POST"),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const updated = await prisma.studentCard.findUniqueOrThrow({
      where: { id: sc.id },
    });
    expect(updated.expiredAt).not.toBeNull();
    // 過期不退/不改 remainingSessions，只是停用該卡
    expect(updated.remainingSessions).toBe(3);
  });

  it("卡片不存在 → 404", async () => {
    const student = await createStudent(classroomId);
    const res = await POST(
      jsonRequest("POST"),
      routeParams({ id: String(student.id), studentCardId: "9999" })
    );
    expect(res.status).toBe(404);
  });

  it("已過期的卡再次過期 → 400 already expired", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId);
    const sc = await createStudentCard(student.id, card.id);
    await prisma.studentCard.update({
      where: { id: sc.id },
      data: { expiredAt: new Date("2026-01-01T00:00:00Z") },
    });

    const res = await POST(
      jsonRequest("POST"),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already expired/i);

    // 原本的 expiredAt 不被覆蓋
    const updated = await prisma.studentCard.findUniqueOrThrow({
      where: { id: sc.id },
    });
    expect(updated.expiredAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("跨教室：過期他人教室的課卡 → 404（不洩漏存在性、不改動）", async () => {
    // 另一個教室與它的課卡
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    const otherStudent = await createStudent(otherClassroom.id, { name: "別人" });
    const otherCard = await createCard(otherClassroom.id);
    const otherSc = await createStudentCard(otherStudent.id, otherCard.id);

    // auth.classroomId 仍是自己的教室
    const res = await POST(
      jsonRequest("POST"),
      routeParams({
        id: String(otherStudent.id),
        studentCardId: String(otherSc.id),
      })
    );
    expect(res.status).toBe(404);

    const untouched = await prisma.studentCard.findUniqueOrThrow({
      where: { id: otherSc.id },
    });
    expect(untouched.expiredAt).toBeNull();
  });

  it("卡片不屬於該學生 (id 與 studentCardId 對不上) → 400", async () => {
    const studentA = await createStudent(classroomId, { name: "A" });
    const studentB = await createStudent(classroomId, { name: "B" });
    const card = await createCard(classroomId);
    const scOfB = await createStudentCard(studentB.id, card.id);

    // 用 studentA 的 id 去過期 studentB 的卡
    const res = await POST(
      jsonRequest("POST"),
      routeParams({ id: String(studentA.id), studentCardId: String(scOfB.id) })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/does not belong/i);

    // 沒被改動
    const updated = await prisma.studentCard.findUniqueOrThrow({
      where: { id: scOfB.id },
    });
    expect(updated.expiredAt).toBeNull();
  });
});
