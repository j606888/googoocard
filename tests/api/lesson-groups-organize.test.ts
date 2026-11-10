import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createLesson, jsonRequest, routeParams } from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0, role: "owner" }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST as ORGANIZE } from "@/app/api/lesson-groups/organize/route";

const organize = (body: unknown) => ORGANIZE(jsonRequest("POST", body), routeParams({}));

describe("POST /api/lesson-groups/organize", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
    auth.classroomId = classroomId;
  });

  it("creates missing 課種, reuses existing ones and moves the lessons", async () => {
    const existing = await prisma.lessonGroup.create({ data: { name: "Salsa", classroomId } });
    const a = (await createLesson(classroomId)).lesson;
    const b = (await createLesson(classroomId)).lesson;
    const c = (await createLesson(classroomId)).lesson;

    const res = await organize({
      series: [
        { name: "Bachata training", lessonIds: [a.id, b.id] },
        { name: "Salsa", lessonIds: [c.id] },
      ],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 3 });
    const created = await prisma.lessonGroup.findFirstOrThrow({
      where: { classroomId, name: "Bachata training" },
    });
    const rows = await prisma.lesson.findMany({ where: { classroomId }, orderBy: { id: "asc" } });
    expect(rows.map((l) => l.groupId)).toEqual([created.id, created.id, existing.id]);
    expect(await prisma.lessonGroup.count({ where: { classroomId } })).toBe(2);
  });

  it("rejects the whole batch when a lesson belongs to another classroom", async () => {
    const mine = (await createLesson(classroomId)).lesson;
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const theirs = (await createLesson(other.id)).lesson;

    const res = await organize({ series: [{ name: "X", lessonIds: [mine.id, theirs.id] }] });

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("LESSON_NOT_FOUND");
    expect(await prisma.lessonGroup.count()).toBe(0);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: theirs.id } })).groupId).toBeNull();
  });

  it("rejects a lesson listed under two series and an empty name", async () => {
    const lesson = (await createLesson(classroomId)).lesson;
    const twice = await organize({
      series: [
        { name: "A", lessonIds: [lesson.id] },
        { name: "B", lessonIds: [lesson.id] },
      ],
    });
    expect((await twice.json()).code).toBe("LESSON_IN_TWO_SERIES");

    const blank = await organize({ series: [{ name: "  ", lessonIds: [lesson.id] }] });
    expect(blank.status).toBe(400);
  });
});
