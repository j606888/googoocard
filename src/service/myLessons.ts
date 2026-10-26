import prisma from "@/lib/prisma";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { locationSummarySelect } from "@/lib/locations";
import { teacherSummarySelect } from "@/lib/teachers";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Today plus the next six days (Taipei). */
export const MY_LESSONS_WINDOW_DAYS = 7;

/**
 * 我接下來的課: the periods of lessons taught by the Teacher row linked to this
 * member (`Teacher.userId`), from the start of today through the next week.
 * `teacher: null` = not linked, so the lessons page shows nothing extra.
 *
 * Today's periods stay in even after they've started — the teacher still
 * needs them to take attendance — but ended-by-hand lessons drop out.
 */
export async function getMyUpcomingPeriods(userId: number, classroomId: number, now = new Date()) {
  const teacher = await prisma.teacher.findFirst({
    where: { classroomId, userId },
    select: teacherSummarySelect,
  });
  if (!teacher) return { teacher: null, periods: [] };

  const { start } = parseTaipeiDateRange(toTaipeiDateKey(now));
  const end = new Date(start.getTime() + MY_LESSONS_WINDOW_DAYS * DAY_MS);

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      startTime: { gte: start, lt: end },
      lesson: { classroomId, endedAt: null, teachers: { some: { teacherId: teacher.id } } },
    },
    orderBy: { startTime: "asc" },
    take: 20,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      attendanceTakenAt: true,
      _count: { select: { attendanceRecords: true } },
      lesson: {
        select: {
          id: true,
          name: true,
          level: true,
          danceStyle: { select: danceStyleSummarySelect },
          location: { select: locationSummarySelect },
          teachers: { select: { teacher: { select: teacherSummarySelect } }, orderBy: { id: "asc" } },
        },
      },
    },
  });

  return {
    teacher,
    periods: periods.map(({ _count, lesson, ...period }) => ({
      ...period,
      attendanceCount: _count.attendanceRecords,
      lesson: { ...lesson, teachers: lesson.teachers.map(({ teacher }) => teacher) },
    })),
  };
}
