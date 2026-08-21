import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createLessonGroup,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { GET as listGroups, POST as createGroup } from "@/app/api/lesson-groups/route";
import { PUT as renameGroup, DELETE as deleteGroup } from "@/app/api/lesson-groups/[id]/route";
import { POST as createLessonRoute } from "@/app/api/lessons/route";
import { PUT as updateLesson } from "@/app/api/lessons/[id]/route";

describe("/api/lesson-groups", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("lists groups with their member lesson count", async () => {
    const group = await createLessonGroup(classroomId, "週日課");
    await createLesson(classroomId, { name: "Bachata Lv2", groupId: group.id });
    await createLesson(classroomId, { name: "Salsa 單人", groupId: group.id });
    await createLesson(classroomId, { name: "Ungrouped" }); // stays out of every group

    const res = await listGroups();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([{ id: group.id, name: "週日課", lessonCount: 2 }]);
  });

  it("creates a group", async () => {
    const res = await createGroup(jsonRequest("POST", { name: "週四課" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe("週四課");
    expect(await prisma.lessonGroup.count({ where: { classroomId } })).toBe(1);
  });

  it("re-creating an existing name upserts instead of erroring (Tag-style idempotency)", async () => {
    const first = await (await createGroup(jsonRequest("POST", { name: "週日課" }))).json();
    const second = await (await createGroup(jsonRequest("POST", { name: "週日課" }))).json();
    expect(second.id).toBe(first.id);
    expect(await prisma.lessonGroup.count({ where: { classroomId } })).toBe(1);
  });

  it("rejects an empty name", async () => {
    const res = await createGroup(jsonRequest("POST", { name: "  " }));
    expect(res.status).toBe(400);
  });

  it("renames a group", async () => {
    const group = await createLessonGroup(classroomId, "週日課");
    const res = await renameGroup(
      jsonRequest("PUT", { name: "週日下午課" }),
      routeParams({ id: String(group.id) })
    );
    expect(res.status).toBe(200);
    const after = await prisma.lessonGroup.findUniqueOrThrow({ where: { id: group.id } });
    expect(after.name).toBe("週日下午課");
  });

  it("deleting a group ungroups its lessons instead of deleting them (FK ON DELETE SET NULL)", async () => {
    const group = await createLessonGroup(classroomId, "週日課");
    const lesson = await createLesson(classroomId, { name: "Bachata Lv2", groupId: group.id });

    const res = await deleteGroup(jsonRequest("DELETE"), routeParams({ id: String(group.id) }));
    expect(res.status).toBe(200);
    expect(await prisma.lessonGroup.count({ where: { id: group.id } })).toBe(0);
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.lesson.id } });
    expect(after.groupId).toBeNull();
  });

  it("POST /api/lessons with another classroom's groupId → 404, no lesson created", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "foreign2@test.local", name: "Foreign2", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Foreign Classroom 2" },
    });
    const foreignGroup = await createLessonGroup(otherClassroom.id, "別人的群組");

    const res = await createLessonRoute(
      jsonRequest("POST", {
        lessonName: "Sneaky",
        teacherIds: [],
        cardIds: [],
        danceType: "BACHATA",
        groupId: foreignGroup.id,
      })
    );
    expect(res.status).toBe(404);
    expect(await prisma.lesson.count({ where: { classroomId } })).toBe(0);
  });

  it("PUT /api/lessons/[id] with another classroom's groupId → 404, lesson unchanged", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "foreign3@test.local", name: "Foreign3", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Foreign Classroom 3" },
    });
    const foreignGroup = await createLessonGroup(otherClassroom.id, "別人的群組2");
    const { lesson } = await createLesson(classroomId, { name: "Bachata Lv1" });

    const res = await updateLesson(
      jsonRequest("PUT", {
        lessonName: "Bachata Lv1",
        teacherIds: [],
        cardIds: [],
        danceType: "BACHATA",
        groupId: foreignGroup.id,
      }),
      routeParams({ id: String(lesson.id) })
    );
    expect(res.status).toBe(404);
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(after.groupId).toBeNull();
  });

  it("rename/delete on another classroom's group → 404, unchanged", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "foreign@test.local", name: "Foreign", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Foreign Classroom" },
    });
    const foreignGroup = await createLessonGroup(otherClassroom.id, "別人的群組");

    const renameRes = await renameGroup(
      jsonRequest("PUT", { name: "hacked" }),
      routeParams({ id: String(foreignGroup.id) })
    );
    expect(renameRes.status).toBe(404);

    const deleteRes = await deleteGroup(
      jsonRequest("DELETE"),
      routeParams({ id: String(foreignGroup.id) })
    );
    expect(deleteRes.status).toBe(404);

    const after = await prisma.lessonGroup.findUniqueOrThrow({ where: { id: foreignGroup.id } });
    expect(after.name).toBe("別人的群組");
  });
});
