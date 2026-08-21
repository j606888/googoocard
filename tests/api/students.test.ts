import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createStudent, jsonRequest } from "../factories";
import { createStudent as createStudentService } from "@/service/student";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, POST } from "@/app/api/students/route";

// A second classroom (own owner — createClassroom() hardcodes one email).
async function createOtherClassroom() {
  const user = await prisma.user.create({
    data: { email: "other@test.local", name: "Other", password: "x" },
  });
  return prisma.classroom.create({
    data: { ownerId: user.id, name: "Other Classroom" },
  });
}

function listRequest(params?: string) {
  return new Request(`http://test.local/api/students${params ? `?${params}` : ""}`, {
    method: "GET",
  });
}

describe("學生編號 (每教室從 1 開始)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("同教室依序建立學生，編號 1,2,3... 遞增", async () => {
    const a = await createStudentService(classroomId, { name: "A", avatarUrl: "/a.png" });
    const b = await createStudentService(classroomId, { name: "B", avatarUrl: "/b.png" });
    const c = await createStudentService(classroomId, { name: "C", avatarUrl: "/c.png" });

    expect([a.number, b.number, c.number]).toEqual([1, 2, 3]);
  });

  it("不同教室各自從 1 開始編號", async () => {
    const other = await createOtherClassroom();

    const s1 = await createStudentService(classroomId, { name: "A", avatarUrl: "/a.png" });
    const s2 = await createStudentService(other.id, { name: "B", avatarUrl: "/b.png" });

    expect(s1.number).toBe(1);
    expect(s2.number).toBe(1);
  });

  it("併發建立同教室學生不會撞號", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createStudentService(classroomId, { name: `S${i}`, avatarUrl: "/a.png" })
      )
    );

    const numbers = results.map((s) => s.number).sort((x, y) => x - y);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("POST /api/students 回傳內容含 number", async () => {
    const res = await POST(
      jsonRequest("POST", { name: "Amy", avatarUrl: "/images/avatar_1.png" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.number).toBe(1);
  });

  it("刪除學生後編號不回收，下一位接續最大編號", async () => {
    const a = await createStudentService(classroomId, { name: "A", avatarUrl: "/a.png" });
    await prisma.student.delete({ where: { id: a.id } });

    const b = await createStudentService(classroomId, { name: "B", avatarUrl: "/b.png" });
    expect(b.number).toBe(2);
  });
});

describe("GET /api/students 排序", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("預設（不帶 sort）依姓名排序", async () => {
    await createStudent(classroomId, { name: "Charlie" });
    await createStudent(classroomId, { name: "Amy" });
    await createStudent(classroomId, { name: "Bob" });

    const res = await GET(listRequest());
    const students = await res.json();
    expect(students.map((s: { name: string }) => s.name)).toEqual(["Amy", "Bob", "Charlie"]);
  });

  it("sort=number 依編號遞增排序", async () => {
    const c = await createStudent(classroomId, { name: "Charlie" }); // number 1
    const a = await createStudent(classroomId, { name: "Amy" }); // number 2
    void c;
    void a;

    const res = await GET(listRequest("sort=number"));
    const students = await res.json();
    expect(students.map((s: { name: string }) => s.name)).toEqual(["Charlie", "Amy"]);
  });
});
