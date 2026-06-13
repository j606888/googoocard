import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent } from "../factories";

// Mock the LINE ID-token verification so the token string IS the lineUserId.
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token } : null,
}));

import { POST } from "@/app/api/liff/select-student/route";

function selectRequest(token: string | null, studentId: number) {
  return new Request("http://test.local/api/liff/select-student", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ studentId }),
  });
}

describe("POST /api/liff/select-student", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  it("設定自己綁定的學生 → 寫入 LineAccount.selectedStudentId", async () => {
    const s = await createStudent(classroomId, { name: "Amy" });
    await prisma.student.update({ where: { id: s.id }, data: { lineUserId: "lineAmy" } });

    const res = await POST(selectRequest("lineAmy", s.id));
    expect(res.status).toBe(200);
    const acc = await prisma.lineAccount.findUnique({ where: { lineUserId: "lineAmy" } });
    expect(acc?.selectedStudentId).toBe(s.id);
  });

  it("選別人的學生（lineUserId 不符）→ 403，且不寫入", async () => {
    const mine = await createStudent(classroomId, { name: "Mine" });
    await prisma.student.update({ where: { id: mine.id }, data: { lineUserId: "lineMe" } });
    const other = await createStudent(classroomId, { name: "Other" });
    await prisma.student.update({ where: { id: other.id }, data: { lineUserId: "lineOther" } });

    const res = await POST(selectRequest("lineMe", other.id));
    expect(res.status).toBe(403);
    const acc = await prisma.lineAccount.findUnique({ where: { lineUserId: "lineMe" } });
    expect(acc).toBeNull();
  });
});
