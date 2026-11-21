import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createCard,
  createLesson,
  createStudent,
  createStudentCard,
} from "../factories";
import { getRecentPeriods } from "@/service/recentPeriods";

async function addPeriod(lessonId: number, start: string, taken = true) {
  const startTime = new Date(start);
  return prisma.lessonPeriod.create({
    data: {
      lessonId,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      attendanceTakenAt: taken ? startTime : null,
    },
  });
}

describe("getRecentPeriods", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
  });

  it("lists only taken periods of this classroom, newest first, capped by limit", async () => {
    const { lesson } = await createLesson(classroomId, { name: "Bachata" });
    const old = await addPeriod(lesson.id, "2026-10-01T11:30:00Z");
    const newer = await addPeriod(lesson.id, "2026-10-08T11:30:00Z");
    const newest = await addPeriod(lesson.id, "2026-10-15T11:30:00Z");
    await addPeriod(lesson.id, "2026-10-22T11:30:00Z", false);

    const other = (await createClassroom({ name: "Other", email: "other@test.local" })).id;
    const { lesson: foreign } = await createLesson(other, { name: "Foreign" });
    await addPeriod(foreign.id, "2026-10-20T11:30:00Z");

    const all = await getRecentPeriods(classroomId);
    expect(all.map((p) => p.id)).toEqual([newest.id, newer.id, old.id]);
    expect(all[0].lesson).toMatchObject({ id: lesson.id, name: "Bachata" });

    expect((await getRecentPeriods(classroomId, 2)).map((p) => p.id)).toEqual([newest.id, newer.id]);
  });

  it("reports attendees and the same revenue as periodRevenue (card share × sessions used, plus drop-ins)", async () => {
    const { lesson } = await createLesson(classroomId);
    const period = await addPeriod(lesson.id, "2026-10-15T11:30:00Z");
    const card = await createCard(classroomId);
    const withCard = await createStudent(classroomId, { name: "有卡" });
    const double = await createStudent(classroomId, { name: "扣兩格" });
    const dropIn = await createStudent(classroomId, { name: "單堂" });
    const noCard = await createStudent(classroomId, { name: "沒卡" });
    const cardA = await createStudentCard(withCard.id, card.id, { finalPrice: 2000, totalSessions: 6 });
    const cardB = await createStudentCard(double.id, card.id, { finalPrice: 3000, totalSessions: 6 });

    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: withCard.id, studentCardId: cardA.id },
    });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: double.id, studentCardId: cardB.id, sessionsUsed: 2 },
    });
    await prisma.attendanceRecord.create({
      data: {
        lessonPeriodId: period.id,
        studentId: dropIn.id,
        dropInCharge: { create: { amount: 400 } },
      },
    });
    await prisma.attendanceRecord.create({
      data: { lessonPeriodId: period.id, studentId: noCard.id },
    });

    const [row] = await getRecentPeriods(classroomId);
    expect(row.attendeeCount).toBe(4);
    // 2000/6 + 3000/6×2 + 400 = 1733.33…
    expect(row.revenue).toBe(1733);
  });
});
