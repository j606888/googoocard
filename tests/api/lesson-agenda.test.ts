import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createLesson, createStudent } from "../factories";
import { getLessonAgenda } from "@/service/lessonAgenda";

const NOW = new Date("2026-10-29T07:20:00Z");
const h = (iso: string) => new Date(iso);

async function addPeriod(lessonId: number, start: string, end: string, taken = false) {
  return prisma.lessonPeriod.create({
    data: {
      lessonId,
      startTime: h(start),
      endTime: h(end),
      attendanceTakenAt: taken ? h(start) : null,
    },
  });
}

describe("getLessonAgenda", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
  });

  it("returns started-untaken, in-class and upcoming periods of in-progress lessons only", async () => {
    const { lesson } = await createLesson(classroomId, { name: "Bachata" });
    const takenPast = await addPeriod(lesson.id, "2026-10-15T07:00:00Z", "2026-10-15T08:00:00Z", true);
    const untakenPast = await addPeriod(lesson.id, "2026-10-22T07:00:00Z", "2026-10-22T08:00:00Z");
    const inClassTaken = await addPeriod(lesson.id, "2026-10-29T07:00:00Z", "2026-10-29T08:00:00Z", true);
    const future = await addPeriod(lesson.id, "2026-11-05T07:00:00Z", "2026-11-05T08:00:00Z");

    const { lesson: finished } = await createLesson(classroomId, { name: "Done" });
    await prisma.lesson.update({ where: { id: finished.id }, data: { status: "finished" } });
    await addPeriod(finished.id, "2026-10-22T07:00:00Z", "2026-10-22T08:00:00Z");

    const other = (await createClassroom({ name: "Other", email: "other@test.local" })).id;
    const { lesson: foreign } = await createLesson(other, { name: "Foreign" });
    await addPeriod(foreign.id, "2026-10-22T07:00:00Z", "2026-10-22T08:00:00Z");

    const { periods } = await getLessonAgenda(classroomId, NOW);
    expect(periods.map((p) => p.id).sort()).toEqual(
      [untakenPast.id, inClassTaken.id, future.id].sort()
    );
    expect(periods.map((p) => p.id)).not.toContain(takenPast.id);

    const current = periods.find((p) => p.id === inClassTaken.id)!;
    expect(current.number).toBe(3);
    expect(current.lesson).toMatchObject({ name: "Bachata", totalPeriods: 4, studentCount: 0 });
  });

  it("returns the member's own teacher and their next period even past the classroom-wide cut", async () => {
    const user = await prisma.user.create({ data: { email: "mia@test.local", password: "x", name: "Mia" } });
    const mia = await prisma.teacher.create({ data: { classroomId, name: "Mia", userId: user.id } });
    const { lesson: busy } = await createLesson(classroomId, { name: "Busy" });
    for (let d = 1; d <= 12; d++) {
      await addPeriod(busy.id, `2026-11-${String(d).padStart(2, "0")}T07:00:00Z`, `2026-11-${String(d).padStart(2, "0")}T08:00:00Z`);
    }
    const { lesson: mine } = await createLesson(classroomId, { name: "Mine" });
    await prisma.lessonTeacher.create({ data: { lessonId: mine.id, teacherId: mia.id } });
    const myNext = await addPeriod(mine.id, "2026-11-20T07:00:00Z", "2026-11-20T08:00:00Z");

    const result = await getLessonAgenda(classroomId, NOW, user.id);
    expect(result.myTeacherId).toBe(mia.id);
    expect(result.periods.map((p) => p.id)).toContain(myNext.id);
    expect((await getLessonAgenda(classroomId, NOW)).myTeacherId).toBeNull();
  });

  it("lists who already has a record for the period", async () => {
    const { lesson } = await createLesson(classroomId);
    const period = await addPeriod(lesson.id, "2026-10-29T07:00:00Z", "2026-10-29T08:00:00Z", true);
    const student = await createStudent(classroomId, { name: "小明" });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: student.id },
    });

    const { periods } = await getLessonAgenda(classroomId, NOW);
    expect(periods[0].attendeeIds).toEqual([student.id]);
  });
});
