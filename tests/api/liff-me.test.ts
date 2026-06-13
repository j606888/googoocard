import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent } from "../factories";

// The LIFF ID token is verified by LINE's external endpoint — mock it so the
// token string IS the resolved lineUserId ("bad" → invalid token).
vi.mock("@/lib/line", () => ({
  verifyIdToken: async (token: string) =>
    token && token !== "bad" ? { userId: token } : null,
}));

import { GET } from "@/app/api/liff/me/route";

function liffRequest(token: string | null, studentId?: number) {
  const url = studentId
    ? `http://test.local/api/liff/me?studentId=${studentId}`
    : "http://test.local/api/liff/me";
  return new Request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function bindStudent(studentId: number, lineUserId: string) {
  await prisma.student.update({ where: { id: studentId }, data: { lineUserId } });
}

describe("GET /api/liff/me", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
  });

  it("無效 token → 401", async () => {
    const res = await GET(liffRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("缺少 Authorization → 401", async () => {
    const res = await GET(liffRequest(null));
    expect(res.status).toBe(401);
  });

  it("未綁定任何學生 → 403 not_bound", async () => {
    const res = await GET(liffRequest("lineGhost"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_bound");
  });

  it("綁定單一學生 → 直接回該生明細", async () => {
    const student = await createStudent(classroomId, { name: "Amy" });
    await bindStudent(student.id, "lineA");

    const res = await GET(liffRequest("lineA"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(student.id);
    expect(body.name).toBe("Amy");
    expect(body.overview).toBeDefined();
    expect(body.studentCards).toBeDefined();
  });

  it("綁定多個學生 → 回 needsSelection 清單", async () => {
    const s1 = await createStudent(classroomId, { name: "Amy" });
    const s2 = await createStudent(classroomId, { name: "Bob" });
    await bindStudent(s1.id, "lineMulti");
    await bindStudent(s2.id, "lineMulti");

    const res = await GET(liffRequest("lineMulti"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsSelection).toBe(true);
    expect(body.students.map((s: { id: number }) => s.id).sort()).toEqual(
      [s1.id, s2.id].sort()
    );
  });

  it("帶 studentId 指定自己綁定的學生 → 回該生明細", async () => {
    const s1 = await createStudent(classroomId, { name: "Amy" });
    const s2 = await createStudent(classroomId, { name: "Bob" });
    await bindStudent(s1.id, "lineMulti");
    await bindStudent(s2.id, "lineMulti");

    const res = await GET(liffRequest("lineMulti", s2.id));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(s2.id);
  });

  it("帶 studentId 指定別人的學生 → 403 forbidden（防越權）", async () => {
    const mine = await createStudent(classroomId, { name: "Mine" });
    const other = await createStudent(classroomId, { name: "Other" });
    await bindStudent(mine.id, "lineMe");
    await bindStudent(other.id, "lineOther");

    const res = await GET(liffRequest("lineMe", other.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("回應帶 boundStudents（含跨教室清單，供 LIFF 切換學生用）", async () => {
    const s1 = await createStudent(classroomId, { name: "Amy" });
    const s2 = await createStudent(classroomId, { name: "Bob" });
    await bindStudent(s1.id, "lineMulti");
    await bindStudent(s2.id, "lineMulti");

    const res = await GET(liffRequest("lineMulti", s1.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(s1.id);
    expect(body.boundStudents.map((s: { id: number }) => s.id).sort()).toEqual(
      [s1.id, s2.id].sort()
    );
  });
});
