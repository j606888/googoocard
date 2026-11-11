import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createLocation,
  jsonRequest,
  routeParams,
} from "../factories";

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
    expect(await res.json()).toEqual({ updated: 3, removedGroups: 0 });
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

  it("deletes old groups left empty, but not unrelated empty 課種", async () => {
    const sunday = await prisma.lessonGroup.create({ data: { name: "週日課程", classroomId } });
    const blank = await prisma.lessonGroup.create({ data: { name: "還沒開", classroomId } });
    const a = (await createLesson(classroomId, { name: "Bachata Lv1", groupId: sunday.id })).lesson;
    const b = (await createLesson(classroomId, { name: "Kizomba", groupId: sunday.id })).lesson;

    const res = await organize({
      series: [{ name: "Bachata Lv1", lessonIds: [a.id] }],
      ungroupLessonIds: [b.id],
    });

    expect(await res.json()).toEqual({ updated: 2, removedGroups: 1 });
    expect(await prisma.lessonGroup.findUnique({ where: { id: sunday.id } })).toBeNull();
    expect(await prisma.lessonGroup.findUnique({ where: { id: blank.id } })).not.toBeNull();
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: b.id } })).groupId).toBeNull();
  });

  it("sets each term's location and assistants", async () => {
    const kaohsiung = await createLocation(classroomId, { name: "高雄" });
    const helper = await prisma.teacher.create({ data: { name: "小幫手", classroomId } });
    const teacher = await prisma.teacher.create({ data: { name: "老師", classroomId } });
    const lesson = (await createLesson(classroomId)).lesson;
    await prisma.lessonTeacher.create({ data: { lessonId: lesson.id, teacherId: teacher.id } });
    await prisma.lessonAssistant.create({ data: { lessonId: lesson.id, teacherId: teacher.id } });

    const clash = await organize({
      series: [],
      lessons: [{ id: lesson.id, locationId: kaohsiung.id, assistantIds: [teacher.id] }],
    });
    expect((await clash.json()).code).toBe("ASSISTANT_IS_TEACHER");

    const res = await organize({
      series: [{ name: "Bachata", lessonIds: [lesson.id] }],
      lessons: [{ id: lesson.id, locationId: kaohsiung.id, assistantIds: [helper.id] }],
    });
    expect(res.status).toBe(200);
    const row = await prisma.lesson.findUniqueOrThrow({
      where: { id: lesson.id },
      include: { assistants: true },
    });
    expect(row.locationId).toBe(kaohsiung.id);
    expect(row.assistants.map((a) => a.teacherId)).toEqual([helper.id]);
  });

  it("rejects another classroom's location or assistant", async () => {
    const lesson = (await createLesson(classroomId)).lesson;
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const theirLocation = await createLocation(other.id);
    const theirTeacher = await prisma.teacher.create({ data: { name: "X", classroomId: other.id } });

    const badLocation = await organize({
      series: [],
      lessons: [{ id: lesson.id, locationId: theirLocation.id, assistantIds: [] }],
    });
    expect((await badLocation.json()).code).toBe("LOCATION_NOT_FOUND");

    const badAssistant = await organize({
      series: [],
      lessons: [{ id: lesson.id, locationId: null, assistantIds: [theirTeacher.id] }],
    });
    expect((await badAssistant.json()).code).toBe("ASSISTANT_NOT_FOUND");
  });
});
