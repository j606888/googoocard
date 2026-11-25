import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createLessonGroup,
  defaultDanceStyle,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 0, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { PUT as putSplit } from "@/app/api/lessons/[id]/revenue-split/route";
import { POST as createLessonRoute } from "@/app/api/lessons/route";

describe("PUT /api/lessons/[id]/revenue-split", () => {
  let classroomId: number;
  let teacherId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = classroom.ownerId;
    teacherId = (await prisma.teacher.create({ data: { classroomId, name: "Charlene" } })).id;
  });

  const split = (tid: number) => ({
    steps: [
      { label: "Charlene", teacherId: tid, basis: "total", num: 1, den: 3, amount: null },
      { label: "場地費", teacherId: null, basis: "fixed", num: null, den: null, amount: 500 },
    ],
    remainderLabel: "台南水庫",
  });

  it("存下規則，開新一期（同課種）沿用", async () => {
    const group = await createLessonGroup(classroomId, "Bachata Lv2");
    const { lesson } = await createLesson(classroomId, { groupId: group.id });
    const res = await putSplit(jsonRequest("PUT", split(teacherId)), routeParams({ id: String(lesson.id) }));
    expect(res.status).toBe(200);
    expect((await prisma.lesson.findUnique({ where: { id: lesson.id } }))?.revenueSplit).toMatchObject({
      remainderLabel: "台南水庫",
    });

    const created = await createLessonRoute(
      jsonRequest("POST", {
        lessonName: "Bachata Lv2",
        teacherIds: [],
        cardIds: [],
        danceStyleId: (await defaultDanceStyle(classroomId)).id,
        groupId: group.id,
      })
    );
    expect(created.status).toBeLessThan(300);
    const next = await prisma.lesson.findFirst({ where: { groupId: group.id, id: { not: lesson.id } } });
    expect(next?.revenueSplit).toMatchObject({ remainderLabel: "台南水庫" });
  });

  it("null 清掉規則", async () => {
    const { lesson } = await createLesson(classroomId);
    await putSplit(jsonRequest("PUT", split(teacherId)), routeParams({ id: String(lesson.id) }));
    const res = await putSplit(jsonRequest("PUT", null), routeParams({ id: String(lesson.id) }));
    expect(res.status).toBe(200);
    expect((await prisma.lesson.findUnique({ where: { id: lesson.id } }))?.revenueSplit).toBeNull();
  });

  it("別的教室的老師、壞掉的步驟 → 400", async () => {
    const { lesson } = await createLesson(classroomId);
    const other = await createClassroom({ email: "other@test.local" });
    const foreign = await prisma.teacher.create({ data: { classroomId: other.id, name: "X" } });
    const r1 = await putSplit(jsonRequest("PUT", split(foreign.id)), routeParams({ id: String(lesson.id) }));
    expect(r1.status).toBe(400);
    const r2 = await putSplit(
      jsonRequest("PUT", { steps: [{ label: "A", basis: "total", num: 4, den: 3 }], remainderLabel: "水庫" }),
      routeParams({ id: String(lesson.id) })
    );
    expect(r2.status).toBe(400);
  });

  it("別的教室的課 → 404", async () => {
    const other = await createClassroom({ email: "other@test.local" });
    const { lesson } = await createLesson(other.id);
    const res = await putSplit(jsonRequest("PUT", split(teacherId)), routeParams({ id: String(lesson.id) }));
    expect(res.status).toBe(404);
  });
});
