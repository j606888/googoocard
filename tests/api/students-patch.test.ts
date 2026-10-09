import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createStudent,
  jsonRequest,
  routeParams,
  createDanceStyles,
  type DanceStyleIds,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET, PATCH } from "@/app/api/students/[id]/route";

async function qualificationsOf(studentId: number) {
  const rows = await prisma.studentDanceQualification.findMany({
    where: { studentId },
    orderBy: { danceStyleId: "asc" },
  });
  return rows.map((r) => r.danceStyleId).sort();
}

// Dance style ids for the classroom under test, keyed by the old enum name.
let S: DanceStyleIds;

describe("PATCH /api/students/[id] (資格同步)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    S = await createDanceStyles(classroomId);
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
      jsonRequest("PATCH", baseBody({ danceQualifications: [S.BACHATA, S.ZOUK] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual(
      [S.BACHATA, S.ZOUK].sort()
    );
  });

  it("更新清單會移除被取消的資格", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.BACHATA, S.SALSA],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: [S.SALSA] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual([S.SALSA]);
  });

  it("重複授予同一資格是冪等的", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.BACHATA],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: [S.BACHATA] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual([S.BACHATA]);
  });

  it("不帶 danceQualifications 欄位時資格不變（保護舊 client）", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.BACHATA],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ note: "updated" })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(await qualificationsOf(student.id)).toEqual([S.BACHATA]);
  });

  it("傳空陣列會清空所有資格", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.BACHATA, S.KIZOMBA],
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

  it("別間教室的舞種 id → 400，資格不變", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.BACHATA],
    });
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const foreign = await createDanceStyles(other.id);

    for (const body of [
      { danceLevels: { [S.BACHATA]: 1, [foreign.SALSA]: 1 } },
      { danceQualifications: [S.BACHATA, foreign.SALSA] },
    ]) {
      const res = await PATCH(
        jsonRequest("PATCH", baseBody(body)),
        routeParams({ id: String(student.id) })
      );
      expect(res.status).toBe(400);
    }
    expect(await qualificationsOf(student.id)).toEqual([S.BACHATA]);
  });

  it("GET 回傳的 danceQualifications 是舞種 id、danceLevels 以 id 為 key", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      levels: { [S.HUSTLE]: 2 },
    });
    const body = await (await GET(jsonRequest("GET"), routeParams({ id: String(student.id) }))).json();
    expect(body.danceQualifications).toEqual([S.HUSTLE]);
    expect(body.danceLevels).toEqual({ [S.HUSTLE]: 2 });
    // Embedded so LIFF / the public share page can label it without a teacher session.
    expect(body.qualifiedDanceStyles).toEqual([
      { id: S.HUSTLE, name: "Hustle", color: "stone", hasLevels: true },
    ]);
  });

  it("danceLevels 設定各舞種已完成階級", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.BACHATA, S.ZOUK],
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceLevels: { [S.HUSTLE]: 2, [S.BACHATA]: 1 } })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    const rows = await prisma.studentDanceQualification.findMany({
      where: { studentId: student.id },
    });
    expect(
      Object.fromEntries(rows.map((r) => [r.danceStyleId, r.level]))
    ).toEqual({ [S.HUSTLE]: 2, [S.BACHATA]: 1 }); // ZOUK 被移除
  });

  it("danceLevels 可升級既有資格的階級", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.HUSTLE],
    });

    await PATCH(
      jsonRequest("PATCH", baseBody({ danceLevels: { [S.HUSTLE]: 3 } })),
      routeParams({ id: String(student.id) })
    );

    const row = await prisma.studentDanceQualification.findFirstOrThrow({
      where: { studentId: student.id, danceStyleId: S.HUSTLE },
    });
    expect(row.level).toBe(3);
  });

  it("danceLevels 無效階級 → 400", async () => {
    const student = await createStudent(classroomId, { name: "Amy" });

    for (const danceLevels of [{ [S.HUSTLE]: 4 }, { [S.HUSTLE]: 0 }, { TANGO: 1 }, [S.HUSTLE]]) {
      const res = await PATCH(
        jsonRequest("PATCH", baseBody({ danceLevels })),
        routeParams({ id: String(student.id) })
      );
      expect(res.status).toBe(400);
    }
    expect(await qualificationsOf(student.id)).toEqual([]);
  });

  it("舊格式 danceQualifications 不會把既有階級降回初階（舊分頁保護）", async () => {
    const student = await createStudent(classroomId, {
      name: "Amy",
      qualifications: [S.HUSTLE],
    });
    await prisma.studentDanceQualification.updateMany({
      where: { studentId: student.id, danceStyleId: S.HUSTLE },
      data: { level: 2 },
    });

    const res = await PATCH(
      jsonRequest("PATCH", baseBody({ danceQualifications: [S.HUSTLE, S.ZOUK] })),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    const rows = await prisma.studentDanceQualification.findMany({
      where: { studentId: student.id },
    });
    expect(
      Object.fromEntries(rows.map((r) => [r.danceStyleId, r.level]))
    ).toEqual({ [S.HUSTLE]: 2, [S.ZOUK]: 1 });
  });
});
