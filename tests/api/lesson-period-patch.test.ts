import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createLesson,
  createStudent,
  createPendingAttendance,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { PATCH } from "@/app/api/lessons/[id]/periods/[periodId]/route";

const patch = (lessonId: number, periodId: number, body: unknown) =>
  PATCH(
    jsonRequest("PATCH", body),
    routeParams({ id: String(lessonId), periodId: String(periodId) })
  );

const MOVED = {
  startTime: "2026-06-08T10:00:00.000Z",
  endTime: "2026-06-08T11:00:00.000Z",
};

describe("PATCH /api/lessons/[id]/periods/[periodId] — 改時段日期", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
  });

  it("移動時段，出席紀錄跟著走（這是停課改期的修法，不必刪掉重建）", async () => {
    const { lesson, period } = await createLesson(classroomId, { withPeriod: true });
    const student = await createStudent(classroomId);
    const record = await createPendingAttendance(period!.id, student.id);
    await prisma.lessonPeriod.update({
      where: { id: period!.id },
      data: { attendanceTakenAt: new Date("2026-06-01T11:05:00Z") },
    });

    const res = await patch(lesson.id, period!.id, MOVED);
    expect(res.status).toBe(200);

    const moved = await prisma.lessonPeriod.findUniqueOrThrow({ where: { id: period!.id } });
    expect(moved.startTime.toISOString()).toBe(MOVED.startTime);
    expect(moved.endTime.toISOString()).toBe(MOVED.endTime);
    // 點名事實沒有變，只是掛到新的日期上：紀錄還在、扣的卡沒動。
    expect(moved.attendanceTakenAt).not.toBeNull();
    const kept = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(kept.lessonPeriodId).toBe(period!.id);
    expect(await prisma.attendanceRecord.count()).toBe(1);
  });

  it("lesson.endAt 跟著最後一個時段一起移動", async () => {
    const { lesson, period } = await createLesson(classroomId, { withPeriod: true });

    await patch(lesson.id, period!.id, MOVED);

    const refreshed = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(refreshed.endAt?.toISOString()).toBe(MOVED.endTime);
  });

  it("結束時間不晚於開始時間 → 400", async () => {
    const { lesson, period } = await createLesson(classroomId, { withPeriod: true });

    const res = await patch(lesson.id, period!.id, {
      startTime: "2026-06-08T11:00:00Z",
      endTime: "2026-06-08T11:00:00Z",
    });

    expect(res.status).toBe(400);
    const unchanged = await prisma.lessonPeriod.findUniqueOrThrow({ where: { id: period!.id } });
    expect(unchanged.startTime.toISOString()).toBe("2026-06-01T10:00:00.000Z");
  });

  it("別的教室的課 → 404，且沒有改到任何東西", async () => {
    const other = await createClassroom({ name: "Other", email: "other@test.local" });
    const { lesson, period } = await createLesson(other.id, { withPeriod: true });

    const res = await patch(lesson.id, period!.id, MOVED);

    expect(res.status).toBe(404);
    const unchanged = await prisma.lessonPeriod.findUniqueOrThrow({ where: { id: period!.id } });
    expect(unchanged.startTime.toISOString()).toBe("2026-06-01T10:00:00.000Z");
  });

  it("時段不屬於這堂課 → 404", async () => {
    const { lesson } = await createLesson(classroomId, { withPeriod: true });
    const { period: otherPeriod } = await createLesson(classroomId, {
      name: "Another",
      withPeriod: true,
    });

    const res = await patch(lesson.id, otherPeriod!.id, MOVED);

    expect(res.status).toBe(404);
  });
});
