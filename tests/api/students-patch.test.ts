import { describe, it, expect, beforeEach, vi } from "vitest";
import { DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { PATCH } from "@/app/api/students/[id]/route";

async function qualificationsOf(studentId: number) {
  const rows = await prisma.studentDanceQualification.findMany({
    where: { studentId },
    orderBy: { danceType: "asc" },
  });
  return rows.map((r) => r.danceType).sort();
}

describe("PATCH /api/students/[id] (資格同步)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  const baseBody = (overrides: Record<string, unknown> = {}) => ({
    name: "Amy",
    note: "",
    avatarUrl: "/images/avatar_1.png",
    ...overrides,
  });

  it("設定多個舞種資格", async () => {
    const student = await createStudent(classroomId, { name: "Amy" });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: [DanceType.BACHATA, DanceType.ZOUK] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual(
      [DanceType.BACHATA, DanceType.ZOUK].sort()
    );
  });

  it("更新清單會移除被取消的資格", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [DanceType.BACHATA, DanceType.SALSA],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: [DanceType.SALSA] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual([DanceType.SALSA]);
  });

  it("重複授予同一資格是冪等的", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [DanceType.BACHATA],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: [DanceType.BACHATA] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual([DanceType.BACHATA]);
  });

  it("不帶 danceQualifications 欄位時資格不變（保護舊 client）", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [DanceType.BACHATA],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ note: "updated" })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual([DanceType.BACHATA]);
  });

  it("傳空陣列會清空所有資格", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [DanceType.BACHATA, DanceType.KIZOMBA],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: [] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual([]);
  });

  it("無效的舞種值 → 400", async () => {
    const student = await createStudent(classroomId, { name: "Amy" });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: ["TANGO"] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(400);
    expect(await qualificationsOf(student.id)).toEqual([]);
  });

  it("非陣列值 → 400", async () => {
    const student = await createStudent(classroomId, { name: "Amy" });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: "BACHATA" })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(400);
  });
});
