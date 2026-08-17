import { Classroom, DanceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { toTaipeiDateKey, parseTaipeiDateRange } from "@/lib/taipei-date";

export interface TodayPeriod {
  periodId: number;
  startTime: Date;
  endTime: Date;
  alreadyChecked: boolean;
}

export interface TodayLesson {
  lessonId: number;
  lessonName: string;
  danceType: DanceType;
  periods: TodayPeriod[];
}

export interface TodayLessons {
  date: string;
  today: TodayLesson[];
  nextLesson: { lessonName: string; startTime: Date } | null;
}

/**
 * Resolve the classroom behind a wall-poster check-in QR code.
 *
 * The key is the only credential the public check-in flow has: it is printed on
 * a board in the studio, so anyone who can see the board can use it. It scopes
 * every public endpoint to one classroom — nothing more. Returns null for an
 * unknown/rotated key so callers can 404 without revealing anything.
 */
export async function resolveCheckinClassroom(
  key: string
): Promise<Classroom | null> {
  if (!key) return null;
  return prisma.classroom.findUnique({ where: { checkinKey: key } });
}

/**
 * Today's (Taipei) lessons in a classroom, with each period flagged for whether
 * `studentId` already checked in. Walk-in style: every lesson running today is
 * offered, not just the ones the student is enrolled in. When there is no class
 * today, `nextLesson` carries the next upcoming period so the UI can show
 * 「下次上課」.
 *
 * Shared by the LIFF check-in page (`/api/liff/today`) and the QR board
 * (`/api/checkin/[key]`) so both entrances agree on what「今天的課」means.
 */
export async function getTodayLessons(
  classroomId: number,
  studentId?: number
): Promise<TodayLessons> {
  const now = new Date();
  const todayKey = toTaipeiDateKey(now);
  const { start, end } = parseTaipeiDateRange(todayKey);

  const lessons = await prisma.lesson.findMany({
    where: {
      classroomId,
      periods: { some: { startTime: { gte: start, lt: end } } },
    },
    include: {
      periods: {
        where: { startTime: { gte: start, lt: end } },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const periodIds = lessons.flatMap((lesson) => lesson.periods.map((p) => p.id));
  const checkedRecords =
    studentId && periodIds.length
      ? await prisma.attendanceRecord.findMany({
          where: { studentId, lessonPeriodId: { in: periodIds } },
          select: { lessonPeriodId: true },
        })
      : [];
  const checkedIds = new Set(checkedRecords.map((r) => r.lessonPeriodId));

  const today: TodayLesson[] = lessons.map((lesson) => ({
    lessonId: lesson.id,
    lessonName: lesson.name,
    danceType: lesson.danceType,
    periods: lesson.periods.map((period) => ({
      periodId: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
      alreadyChecked: checkedIds.has(period.id),
    })),
  }));

  let nextLesson: { lessonName: string; startTime: Date } | null = null;
  if (today.length === 0) {
    const next = await prisma.lessonPeriod.findFirst({
      where: { lesson: { classroomId }, startTime: { gt: now } },
      orderBy: { startTime: "asc" },
      include: { lesson: { select: { name: true } } },
    });
    if (next) {
      nextLesson = { lessonName: next.lesson.name, startTime: next.startTime };
    }
  }

  return { date: todayKey, today, nextLesson };
}
