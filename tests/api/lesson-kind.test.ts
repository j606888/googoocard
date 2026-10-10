import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createLesson, jsonRequest, routeParams } from "../factories";
import { refreshLesson } from "@/service/lesson";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST as endLesson, DELETE as reopenLesson } from "@/app/api/lessons/[id]/end/route";
import { POST as createPeriods } from "@/app/api/lessons/[id]/periods/route";

const params = (id: number) => routeParams({ id: String(id) });
const checkAll = (lessonId: number) =>
  prisma.lessonPeriod.updateMany({
    where: { lessonId },
    data: { attendanceTakenAt: new Date("2026-06-01T11:05:00Z") },
  });
const statusOf = async (id: number) =>
  (await prisma.lesson.findUniqueOrThrow({ where: { id } })).status;

describe("課程型態（固定期數 / 持續開課）與手動結束", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("固定期數：時段全部點完 → 已結束（原本的行為）", async () => {
    const { lesson } = await createLesson(classroomId, { withPeriod: true });
    await checkAll(lesson.id);
    await refreshLesson(lesson.id);
    expect(await statusOf(lesson.id)).toBe("finished");
  });

  it("持續開課：時段全部點完仍是進行中", async () => {
    const { lesson } = await createLesson(classroomId, { withPeriod: true, kind: "ongoing" });
    await checkAll(lesson.id);
    await refreshLesson(lesson.id);
    expect(await statusOf(lesson.id)).toBe("inProgress");
  });

  it("手動結束 → 已結束；重新開課 → 回到型態自己的規則", async () => {
    const { lesson } = await createLesson(classroomId, { withPeriod: true, kind: "ongoing" });

    expect((await endLesson(jsonRequest("POST", {}), params(lesson.id))).status).toBe(200);
    expect(await statusOf(lesson.id)).toBe("finished");

    expect((await reopenLesson(jsonRequest("DELETE", {}), params(lesson.id))).status).toBe(200);
    expect(await statusOf(lesson.id)).toBe("inProgress");
  });

  it("替已結束的課排新時段會重新開課", async () => {
    const { lesson } = await createLesson(classroomId, { withPeriod: true, kind: "ongoing" });
    await endLesson(jsonRequest("POST", {}), params(lesson.id));

    const res = await createPeriods(
      jsonRequest("POST", {
        periods: [
          { startTime: "2026-06-08T10:00:00.000Z", endTime: "2026-06-08T11:00:00.000Z" },
          { startTime: "2026-06-15T10:00:00.000Z", endTime: "2026-06-15T11:00:00.000Z" },
        ],
      }),
      params(lesson.id)
    );
    expect(res.status).toBe(200);
    expect(await prisma.lessonPeriod.count({ where: { lessonId: lesson.id } })).toBe(3);
    const reopened = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(reopened.endedAt).toBeNull();
    expect(reopened.status).toBe("inProgress");
  });

  it("單一時段的舊 body 格式仍然可用", async () => {
    const { lesson } = await createLesson(classroomId);
    const res = await createPeriods(
      jsonRequest("POST", { startTime: "2026-06-08T10:00:00.000Z", endTime: "2026-06-08T11:00:00.000Z" }),
      params(lesson.id)
    );
    expect(res.status).toBe(200);
    expect(await prisma.lessonPeriod.count({ where: { lessonId: lesson.id } })).toBe(1);
  });

  it("別的教室的課 → 404", async () => {
    const other = await createClassroom({ email: "other@test.local" });
    const { lesson } = await createLesson(other.id);
    expect((await endLesson(jsonRequest("POST", {}), params(lesson.id))).status).toBe(404);
    const res = await createPeriods(
      jsonRequest("POST", { startTime: "2026-06-08T10:00:00.000Z", endTime: "2026-06-08T11:00:00.000Z" }),
      params(lesson.id)
    );
    expect(res.status).toBe(404);
  });
});
