import prisma from "@/lib/prisma";
import { danceStyleSummarySelect, type DanceStyleSummary } from "@/lib/danceStyles";
import { parseTaipeiMonthRange } from "@/lib/taipei-date";
import { locationSummarySelect } from "@/lib/locations";
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

/** 老師列表上的一堂課：課名、舞種、分部，加上最近一個時段（沒有還沒上的時段時拿來當「週四 20:30」）。 */
const overviewLessonSelect = {
  id: true,
  name: true,
  status: true,
  danceStyle: { select: danceStyleSummarySelect },
  location: { select: locationSummarySelect },
  periods: { select: { startTime: true }, orderBy: { startTime: "desc" }, take: 1 },
} as const;

/** 細節頁的一堂課（教的、協助的同一個形狀）。 */
const detailLessonSelect = {
  id: true,
  name: true,
  status: true,
  kind: true,
  level: true,
  danceStyle: { select: danceStyleSummarySelect },
  location: { select: locationSummarySelect },
  periods: {
    select: {
      startTime: true,
      attendanceTakenAt: true,
      _count: { select: { attendanceRecords: true } },
    },
  },
} as const;

type DetailLesson = {
  id: number;
  name: string;
  status: string;
  kind: string;
  level: number;
  danceStyle: DanceStyleSummary;
  location: { id: number; name: string } | null;
  periods: { startTime: Date; attendanceTakenAt: Date | null; _count: { attendanceRecords: number } }[];
};

function toLessonRow(lesson: DetailLesson, now: Date) {
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
    location: lesson.location,
    totalPeriods: lesson.periods.length,
    taughtCount: taught.length,
    avgAttendance: taught.length > 0 ? roundOne(attendance / taught.length) : null,
    firstStart: starts.length > 0 ? new Date(Math.min(...starts)) : null,
    lastStart: starts.length > 0 ? new Date(Math.max(...starts)) : null,
    nextStart: nextStart !== undefined ? new Date(nextStart) : null,
  };
}

/** Most recent first: by last period, lessons without periods last. */
const byLastStart = (a: { lastStart: Date | null }, b: { lastStart: Date | null }) =>
  (b.lastStart?.getTime() ?? 0) - (a.lastStart?.getTime() ?? 0);

/**
 * Every teacher of the classroom with the in-progress lessons they teach and
 * their current / next period. Teachers with a class coming up first, soonest
 * on top. (Monthly numbers live on the teacher's own page.)
 */
export async function getTeachersOverview(classroomId: number, now = new Date()) {
  const [teachers, upcoming, unassignedLessonCount] = await Promise.all([
    prisma.teacher.findMany({
      // 老師頁只放會教課的人（老師／老師＋小幫手）；純小幫手、不上課的管理員在團隊頁。
      where: { classroomId, kind: { notIn: ["ASSISTANT", "NONE"] } },
      select: {
        ...teacherPayloadSelect,
        userId: true,
        lessons: {
          select: { lesson: { select: overviewLessonSelect } },
          orderBy: { lessonId: "asc" },
        },
        // 當小幫手的進行中課程——另外列在「協助」，不算教課。
        assistedLessons: {
          where: { lesson: { status: "inProgress" } },
          select: { lesson: { select: overviewLessonSelect } },
          orderBy: { lessonId: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }),
    // Not over yet: a period under way right now comes first (`ongoing`).
    prisma.lessonPeriod.findMany({
      where: { endTime: { gt: now }, lesson: { classroomId, status: "inProgress" } },
      orderBy: { startTime: "asc" },
      select: {
        startTime: true,
        endTime: true,
        lesson: { select: { id: true, name: true, teachers: { select: { teacherId: true } } } },
      },
    }),
    prisma.lesson.count({
      where: { classroomId, status: "inProgress", teachers: { none: {} } },
    }),
  ]);

  // 每堂課「現在」的時段：還沒上完的下一堂，沒有就用最近一堂——不是開課第一堂（可能早就過了）。
  const nextStartByLesson = new Map<number, Date>();
  for (const period of upcoming) {
    if (!nextStartByLesson.has(period.lesson.id)) nextStartByLesson.set(period.lesson.id, period.startTime);
  }
  const toOverviewLesson = (lesson: (typeof teachers)[number]["lessons"][number]["lesson"]) => ({
    id: lesson.id,
    name: lesson.name,
    status: lesson.status,
    danceStyle: lesson.danceStyle,
    location: lesson.location,
    slotStart: nextStartByLesson.get(lesson.id) ?? lesson.periods[0]?.startTime ?? null,
  });

  const rows = teachers.map(({ lessons, assistedLessons, ...teacher }) => {
    const next = upcoming.find((period) =>
      period.lesson.teachers.some((link) => link.teacherId === teacher.id)
    );

    return {
      ...teacher,
      lessonCount: lessons.length,
      activeLessons: lessons
        .filter(({ lesson }) => lesson.status === "inProgress")
        .map(({ lesson }) => toOverviewLesson(lesson)),
      assistedLessons: assistedLessons.map(({ lesson }) => toOverviewLesson(lesson)),
      nextPeriod: next
        ? {
            startTime: next.startTime,
            endTime: next.endTime,
            lessonId: next.lesson.id,
            lessonName: next.lesson.name,
            ongoing: next.startTime <= now,
          }
        : null,
    };
  });

  rows.sort(
    (a, b) =>
      (a.nextPeriod?.startTime.getTime() ?? Infinity) -
        (b.nextPeriod?.startTime.getTime() ?? Infinity) ||
      b.activeLessons.length - a.activeLessons.length ||
      a.id - b.id
  );

  return { unassignedLessonCount, teachers: rows };
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
      userId: true,
      lessons: { select: { lesson: { select: detailLessonSelect } } },
      // 當小幫手的課（全部狀態）——不進下面任何統計。
      assistedLessons: { select: { lesson: { select: detailLessonSelect } } },
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

  const { lessons, assistedLessons, ...profile } = teacher;
  const allStarts = lessons.flatMap(({ lesson }) => lesson.periods.map((p) => p.startTime));

  return {
    teacher: profile,
    month,
    danceStyles: uniqueStyles(lessons.map(({ lesson }) => lesson.danceStyle)),
    firstTaughtAt: allStarts.length > 0 ? new Date(Math.min(...allStarts.map(Number))) : null,
    stats: summarizeMonth(inMonth.map(toStatPeriod), now),
    previousMonthAttendance: trend[trend.length - 2]?.attendance ?? 0,
    trend,
    lessons: lessons.map(({ lesson }) => toLessonRow(lesson, now)).sort(byLastStart),
    assistedLessons: assistedLessons.map(({ lesson }) => toLessonRow(lesson, now)).sort(byLastStart),
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
