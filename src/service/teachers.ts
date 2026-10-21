import prisma from "@/lib/prisma";
import { danceStyleSummarySelect, type DanceStyleSummary } from "@/lib/danceStyles";
import { parseTaipeiMonthRange } from "@/lib/taipei-date";
import { teacherPayloadSelect } from "@/lib/teachers";
import {
  monthlyTrend,
  monthsEndingAt,
  periodState,
  roundOne,
  summarizeMonth,
  topStudents,
  type StatPeriod,
} from "@/lib/teacherStats";

/** How many months the trend bars cover, ending at the month being viewed. */
const TREND_MONTHS = 6;
const REGULARS_LIMIT = 5;

const statPeriodSelect = {
  startTime: true,
  endTime: true,
  attendanceTakenAt: true,
  attendanceRecords: { select: { studentId: true } },
} as const;

function toStatPeriod(period: {
  startTime: Date;
  endTime: Date;
  attendanceTakenAt: Date | null;
  attendanceRecords: { studentId: number }[];
}): StatPeriod {
  return {
    startTime: period.startTime,
    endTime: period.endTime,
    attendanceTakenAt: period.attendanceTakenAt,
    studentIds: period.attendanceRecords.map((record) => record.studentId),
  };
}

function uniqueStyles(styles: DanceStyleSummary[]): DanceStyleSummary[] {
  return [...new Map(styles.map((style) => [style.id, style])).values()];
}

/** The window the trend covers: the first trend month through the viewed month. */
function trendWindow(month: string) {
  const months = monthsEndingAt(month, TREND_MONTHS);
  return {
    months,
    start: parseTaipeiMonthRange(months[0]).start,
    end: parseTaipeiMonthRange(month).end,
    monthRange: parseTaipeiMonthRange(month),
  };
}

/**
 * Every teacher of the classroom with this month's numbers, the trend, the
 * styles they teach (derived from their lessons — there's nothing to keep in
 * sync) and their next period. Sorted by sessions taught this month.
 */
export async function getTeachersOverview(classroomId: number, month: string, now = new Date()) {
  const { months, start, end, monthRange } = trendWindow(month);

  const [teachers, periods, upcoming, unassignedLessonCount] = await Promise.all([
    prisma.teacher.findMany({
      where: { classroomId },
      select: {
        ...teacherPayloadSelect,
        lessons: {
          select: {
            lesson: { select: { status: true, danceStyle: { select: danceStyleSummarySelect } } },
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.lessonPeriod.findMany({
      where: { lesson: { classroomId }, startTime: { gte: start, lt: end } },
      select: {
        ...statPeriodSelect,
        lesson: { select: { teachers: { select: { teacherId: true } } } },
      },
    }),
    prisma.lessonPeriod.findMany({
      where: { startTime: { gte: now }, lesson: { classroomId, status: "inProgress" } },
      orderBy: { startTime: "asc" },
      select: {
        startTime: true,
        lesson: { select: { id: true, name: true, teachers: { select: { teacherId: true } } } },
      },
    }),
    prisma.lesson.count({
      where: { classroomId, status: "inProgress", teachers: { none: {} } },
    }),
  ]);

  const rows = teachers.map(({ lessons, ...teacher }) => {
    const own = periods.filter((period) =>
      period.lesson.teachers.some((link) => link.teacherId === teacher.id)
    );
    const ownStats = own.map(toStatPeriod);
    const inMonth = ownStats.filter(
      (period) => period.startTime >= monthRange.start && period.startTime < monthRange.end
    );
    const next = upcoming.find((period) =>
      period.lesson.teachers.some((link) => link.teacherId === teacher.id)
    );

    return {
      ...teacher,
      lessonCount: lessons.length,
      activeLessonCount: lessons.filter(({ lesson }) => lesson.status === "inProgress").length,
      danceStyles: uniqueStyles(lessons.map(({ lesson }) => lesson.danceStyle)),
      stats: summarizeMonth(inMonth, now),
      trend: monthlyTrend(ownStats, months).map((bucket) => bucket.sessions),
      nextPeriod: next
        ? { startTime: next.startTime, lessonId: next.lesson.id, lessonName: next.lesson.name }
        : null,
    };
  });

  // Classroom-wide, not a sum of the rows: a co-taught period counts once, and
  // periods of a lesson with no teacher still count.
  const totals = summarizeMonth(
    periods
      .filter((period) => period.startTime >= monthRange.start && period.startTime < monthRange.end)
      .map(toStatPeriod),
    now
  );

  rows.sort(
    (a, b) =>
      b.stats.sessions - a.stats.sessions ||
      b.activeLessonCount - a.activeLessonCount ||
      a.id - b.id
  );

  return { month, months, totals, unassignedLessonCount, teachers: rows };
}

/** One teacher's page: profile, this month's numbers and periods, lessons, trend, regulars. */
export async function getTeacherDetail(
  teacherId: number,
  classroomId: number,
  month: string,
  now = new Date()
) {
  const { months, start, end, monthRange } = trendWindow(month);

  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, classroomId },
    select: {
      ...teacherPayloadSelect,
      lessons: {
        select: {
          lesson: {
            select: {
              id: true,
              name: true,
              status: true,
              kind: true,
              level: true,
              danceStyle: { select: danceStyleSummarySelect },
              periods: {
                select: {
                  startTime: true,
                  attendanceTakenAt: true,
                  _count: { select: { attendanceRecords: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!teacher) return null;

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lesson: { classroomId, teachers: { some: { teacherId } } },
      startTime: { gte: start, lt: end },
    },
    select: {
      id: true,
      ...statPeriodSelect,
      lesson: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const stats = periods.map(toStatPeriod);
  const inMonth = periods.filter(
    (period) => period.startTime >= monthRange.start && period.startTime < monthRange.end
  );
  const trend = monthlyTrend(stats, months);

  const regularCounts = topStudents(stats, REGULARS_LIMIT);
  const regularStudents = await prisma.student.findMany({
    where: { id: { in: regularCounts.map((r) => r.studentId) }, classroomId },
    select: { id: true, name: true, avatarUrl: true },
  });
  const studentById = new Map(regularStudents.map((student) => [student.id, student]));

  const { lessons, ...profile } = teacher;
  const allStarts = lessons.flatMap(({ lesson }) => lesson.periods.map((p) => p.startTime));

  return {
    teacher: profile,
    month,
    danceStyles: uniqueStyles(lessons.map(({ lesson }) => lesson.danceStyle)),
    firstTaughtAt: allStarts.length > 0 ? new Date(Math.min(...allStarts.map(Number))) : null,
    stats: summarizeMonth(inMonth.map(toStatPeriod), now),
    previousMonthAttendance: trend[trend.length - 2]?.attendance ?? 0,
    trend,
    lessons: lessons
      .map(({ lesson }) => {
        const taught = lesson.periods.filter((p) => p.attendanceTakenAt);
        const attendance = taught.reduce((sum, p) => sum + p._count.attendanceRecords, 0);
        const starts = lesson.periods.map((p) => p.startTime.getTime());
        const nextStart = starts.filter((t) => t >= now.getTime()).sort((a, b) => a - b)[0];
        return {
          id: lesson.id,
          name: lesson.name,
          status: lesson.status,
          kind: lesson.kind,
          level: lesson.level,
          danceStyle: lesson.danceStyle,
          totalPeriods: lesson.periods.length,
          taughtCount: taught.length,
          avgAttendance: taught.length > 0 ? roundOne(attendance / taught.length) : null,
          firstStart: starts.length > 0 ? new Date(Math.min(...starts)) : null,
          lastStart: starts.length > 0 ? new Date(Math.max(...starts)) : null,
          nextStart: nextStart !== undefined ? new Date(nextStart) : null,
        };
      })
      // Most recent first: by last period, lessons without periods last.
      .sort((a, b) => (b.lastStart?.getTime() ?? 0) - (a.lastStart?.getTime() ?? 0)),
    periods: inMonth.map((period) => ({
      id: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
      lessonId: period.lesson.id,
      lessonName: period.lesson.name,
      state: periodState(period, now),
      attendance: period.attendanceRecords.length,
    })),
    regulars: regularCounts.flatMap(({ studentId, count }) => {
      const student = studentById.get(studentId);
      return student ? [{ ...student, count }] : [];
    }),
  };
}
