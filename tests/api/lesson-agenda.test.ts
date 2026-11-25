import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { resetDb, createClassroom, createLesson, createLessonGroup, createStudent } from "../factories";
import { getLessonAgenda, getWeekPeriods } from "@/service/lessonAgenda";

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

  it("counts self check-ins apart from the teacher's own records", async () => {
    const { lesson } = await createLesson(classroomId);
    const period = await addPeriod(lesson.id, "2026-10-29T09:00:00Z", "2026-10-29T10:00:00Z");
    const self = await createStudent(classroomId, { name: "自己簽" });
    const byTeacher = await createStudent(classroomId, { name: "老師勾" });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: self.id, source: "STUDENT" },
    });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: byTeacher.id },
    });

    const { periods } = await getLessonAgenda(classroomId, NOW);
    expect(periods[0].attendeeIds).toHaveLength(2);
    expect(periods[0].selfCheckInCount).toBe(1);
  });

  it("numbers a lesson's term within its group by first period, and leaves ungrouped lessons null", async () => {
    const group = await createLessonGroup(classroomId, "Bachata Lv1");
    const { lesson: first } = await createLesson(classroomId, { name: "一期", groupId: group.id });
    await addPeriod(first.id, "2026-06-01T07:00:00Z", "2026-06-01T08:00:00Z", true);
    await prisma.lesson.update({ where: { id: first.id }, data: { status: "finished" } });
    // 還沒排時段的期排最後，不會擠掉進行中那一期的號碼。
    await createLesson(classroomId, { name: "還沒排", groupId: group.id });
    const { lesson: second } = await createLesson(classroomId, { name: "二期", groupId: group.id });
    const current = await addPeriod(second.id, "2026-10-30T07:00:00Z", "2026-10-30T08:00:00Z");
    const { lesson: loose } = await createLesson(classroomId, { name: "散課" });
    const loosePeriod = await addPeriod(loose.id, "2026-10-30T09:00:00Z", "2026-10-30T10:00:00Z");

    const { periods } = await getLessonAgenda(classroomId, NOW);
    expect(periods.find((p) => p.id === current.id)!.lesson).toMatchObject({
      groupId: group.id,
      termNumber: 2,
    });
    expect(periods.find((p) => p.id === loosePeriod.id)!.lesson).toMatchObject({
      groupId: null,
      termNumber: null,
    });
  });
});

describe("getWeekPeriods", () => {
  it("一週（台北週日 00:00 起 7 天）的每一堂，含已點名、已結束的課，不含別的教室", async () => {
    await resetDb();
    const classroomId = (await createClassroom()).id;
    const { lesson } = await createLesson(classroomId, { name: "Bachata" });
    // 2026-11-22（日）00:00 台北 = 2026-11-21T16:00Z
    const before = await addPeriod(lesson.id, "2026-11-21T15:00:00Z", "2026-11-21T15:59:00Z");
    const sunday = await addPeriod(lesson.id, "2026-11-22T06:00:00Z", "2026-11-22T07:00:00Z", true);
    const saturday = await addPeriod(lesson.id, "2026-11-28T15:00:00Z", "2026-11-28T15:30:00Z");
    const next = await addPeriod(lesson.id, "2026-11-28T16:00:00Z", "2026-11-28T17:00:00Z");
    const { lesson: finished } = await createLesson(classroomId, { name: "Done" });
    await prisma.lesson.update({ where: { id: finished.id }, data: { status: "finished" } });
    const finishedPeriod = await addPeriod(finished.id, "2026-11-24T11:00:00Z", "2026-11-24T12:00:00Z", true);
    const other = (await createClassroom({ name: "Other", email: "other@test.local" })).id;
    const { lesson: foreign } = await createLesson(other, { name: "Foreign" });
    await addPeriod(foreign.id, "2026-11-24T11:00:00Z", "2026-11-24T12:00:00Z");

    const { periods } = await getWeekPeriods(classroomId, new Date("2026-11-21T16:00:00Z"));
    const ids = periods.map((p) => p.id);
    expect(ids).toEqual([sunday.id, finishedPeriod.id, saturday.id]);
    expect(ids).not.toContain(before.id);
    expect(ids).not.toContain(next.id);
  });
});
