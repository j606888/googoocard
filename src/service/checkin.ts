import { locationSummarySelect, type LocationSummary } from "@/lib/locations";
import { Classroom, Prisma } from "@prisma/client";
import { danceStyleSummarySelect, type DanceStyleSummary } from "@/lib/danceStyles";
import prisma from "@/lib/prisma";
import {
  toTaipeiDateKey,
  parseTaipeiDateRange,
  parseTaipeiMonthRange,
  toTaipeiMonthKey,
} from "@/lib/taipei-date";
import { canBuyCard, toDanceLevels } from "@/domains/qualification";
import { cardOptionsFor } from "@/domains/attendance/attendance.service";
import { fetchStudentsWithValidCards } from "@/service/lessonCards";

export interface TodayPeriod {
  periodId: number;
  startTime: Date;
  endTime: Date;
  alreadyChecked: boolean;
}

/** One of the student's own cards that can pay for a lesson. */
export interface UsableCardOption {
  studentCardId: number;
  name: string;
  serialNumber: number;
  remainingSessions: number;
  isPracticeCard: boolean;
}

/**
 * One of the lesson's cards the student may buy on the spot. Never a trial
 * card — trials are registered by the teacher on the lesson page.
 */
export interface BuyableCardOption {
  cardId: number;
  name: string;
  sessions: number;
  price: number;
  isPracticeCard: boolean;
}

export interface LessonCardStatus {
  /** Sessions one attendance deducts (外師課 = 2); cards with fewer left aren't in `usable`. */
  sessionsPerAttendance: number;
  usable: UsableCardOption[];
  /** The card the engine would use on its own; null = the student must choose or buy. */
  autoPickId: number | null;
  buyable: BuyableCardOption[];
}

export interface TodayLesson {
  lessonId: number;
  lessonName: string;
  danceStyle: DanceStyleSummary | null;
  periods: TodayPeriod[];
  /** Only when the caller is a student (LIFF): what they can pay with. */
  cardStatus?: LessonCardStatus;
}

/** A future period, for the「下一堂課」/「接下來」of a day with no class. */
export interface UpcomingPeriod {
  periodId: number;
  lessonId: number;
  lessonName: string;
  danceStyle: DanceStyleSummary;
  location: LocationSummary | null;
  startTime: Date;
  endTime: Date;
}

export interface NextLesson extends UpcomingPeriod {
  /** A lesson the student has been in (LessonStudent) — 「你的下一堂」 — rather than just the classroom's next. */
  mine: boolean;
  /** Only with a student: what that lesson would charge. */
  cardStatus?: LessonCardStatus;
}

/** One of the student's cards for the no-class page: still usable, or not paid yet. */
export interface MyCardSummary {
  id: number;
  name: string;
  serialNumber: number;
  remainingSessions: number;
  totalSessions: number;
  /** null = paid. */
  unpaidAmount: number | null;
  lastUsedAt: Date | null;
}

export interface TodayLessons {
  date: string;
  today: TodayLesson[];
  /** Only when there's no class today. */
  nextLesson: NextLesson | null;
  /** Only when there's no class today: the classroom's next few periods besides `nextLesson`. */
  upcoming: UpcomingPeriod[];
  /** Only when there's no class today and a student is given. */
  myCards?: MyCardSummary[];
  monthAttendance?: number;
}

/**
 * Resolve the classroom behind a wall-poster check-in QR code.
 *
 * The key is printed on a board in the studio, so it proves nothing about WHO
 * is scanning — identity always comes from the LINE ID token. It only says
 * which classroom (for self-registration and scoping the LIFF entry). Returns
 * null for an unknown/rotated key so callers can 404 without revealing anything.
 */
export async function resolveCheckinClassroom(
  key: string
): Promise<Classroom | null> {
  if (!key) return null;
  return prisma.classroom.findUnique({ where: { checkinKey: key } });
}

/**
 * The URL the wall QR encodes: the LIFF check-in page carrying the classroom
 * key, so scanning with the phone camera opens it inside LINE (with an ID
 * token). Without a LIFF id it falls back to the old `/checkin/<key>` address,
 * which redirects once one is configured.
 */
export function checkinEntryUrl(key: string, origin: string) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (liffId) return `https://liff.line.me/${liffId}/checkin?key=${encodeURIComponent(key)}`;
  return `${process.env.NEXT_PUBLIC_HOST_URL || origin}/checkin/${key}`;
}

/**
 * Today's (Taipei) lessons in a classroom, with each period flagged for whether
 * `studentId` already checked in. Walk-in style: every lesson running today is
 * offered, not just the ones the student is enrolled in. When there is no class
 * today it says what's next instead — `nextLesson`, `upcoming`, and with a
 * student their cards and this month's count — so the page isn't a dead end.
 *
 * Data source of the LIFF check-in page (`/api/liff/today`).
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
      danceStyle: true,
      location: { select: locationSummarySelect },
      cards: { include: { card: true } },
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

  const today: TodayLesson[] = await Promise.all(
    lessons.map(async (lesson) => ({
      lessonId: lesson.id,
      lessonName: lesson.name,
      danceStyle: pickSummary(lesson.danceStyle),
      location: lesson.location,
      periods: lesson.periods.map((period) => ({
        periodId: period.id,
        startTime: period.startTime,
        endTime: period.endTime,
        alreadyChecked: checkedIds.has(period.id),
      })),
      ...(studentId
        ? { cardStatus: await lessonCardStatus(lesson, studentId, classroomId) }
        : {}),
    }))
  );

  if (today.length > 0) return { date: todayKey, today, nextLesson: null, upcoming: [] };

  // No class today — say when the next one is, so the page isn't a dead end.
  const nextLesson = await findNextLesson(classroomId, studentId, now);
  const upcoming = await findFuturePeriods(
    { lesson: { classroomId, endedAt: null }, ...(nextLesson ? { id: { not: nextLesson.periodId } } : {}) },
    now,
    UPCOMING_COUNT
  );
  if (!studentId) return { date: todayKey, today, nextLesson, upcoming };

  const [myCards, monthAttendance] = await Promise.all([
    myCardSummaries(studentId),
    monthAttendanceCount(studentId, now),
  ]);
  return { date: todayKey, today, nextLesson, upcoming, myCards, monthAttendance };
}

const UPCOMING_COUNT = 2;

const upcomingPeriodSelect = {
  id: true,
  startTime: true,
  endTime: true,
  lesson: {
    select: {
      id: true,
      name: true,
      danceStyle: { select: danceStyleSummarySelect },
      location: { select: locationSummarySelect },
    },
  },
} satisfies Prisma.LessonPeriodSelect;

type UpcomingPeriodRow = Prisma.LessonPeriodGetPayload<{ select: typeof upcomingPeriodSelect }>;

const toUpcoming = (p: UpcomingPeriodRow): UpcomingPeriod => ({
  periodId: p.id,
  lessonId: p.lesson.id,
  lessonName: p.lesson.name,
  danceStyle: p.lesson.danceStyle,
  location: p.lesson.location,
  startTime: p.startTime,
  endTime: p.endTime,
});

/**
 * Periods after `now`, soonest first. Callers filter on `lesson.endedAt: null`
 * like the LINE 課表: a lesson ended by hand has no more classes, and endedAt is
 * always in the past, so that's every future period the LIFF 課表 would show.
 */
async function findFuturePeriods(where: Prisma.LessonPeriodWhereInput, now: Date, take: number) {
  const periods = await prisma.lessonPeriod.findMany({
    where: { ...where, startTime: { gt: now } },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
    take,
    select: upcomingPeriodSelect,
  });
  return periods.map(toUpcoming);
}

/**
 * The next period of a lesson the student has been in (the LIFF 課表's「我的課」),
 * else the classroom's next period — a newcomer still sees when to come. With a
 * student, it carries what that lesson would charge them.
 */
async function findNextLesson(
  classroomId: number,
  studentId: number | undefined,
  now: Date
): Promise<NextLesson | null> {
  const open = { classroomId, endedAt: null };
  const [mine] = studentId
    ? await findFuturePeriods({ lesson: { ...open, students: { some: { studentId } } } }, now, 1)
    : [];
  const [next] = mine ? [mine] : await findFuturePeriods({ lesson: open }, now, 1);
  if (!next) return null;
  if (!studentId) return { ...next, mine: false };

  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: next.lessonId },
    include: { danceStyle: true, cards: { include: { card: true } } },
  });
  return {
    ...next,
    mine: Boolean(mine),
    cardStatus: await lessonCardStatus(lesson, studentId, classroomId),
  };
}

/** Same set as the LINE「我的課卡」reply: usable cards plus any still unpaid, oldest first. */
async function myCardSummaries(studentId: number): Promise<MyCardSummary[]> {
  const cards = await prisma.studentCard.findMany({
    where: {
      studentId,
      OR: [{ remainingSessions: { gt: 0 }, expiredAt: null }, { isPaid: false }],
    },
    select: {
      id: true,
      serialNumber: true,
      remainingSessions: true,
      totalSessions: true,
      isPaid: true,
      finalPrice: true,
      card: { select: { name: true } },
      attendanceRecords: {
        select: { lessonPeriod: { select: { startTime: true } } },
        orderBy: { lessonPeriod: { startTime: "desc" } },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return cards.map((c) => ({
    id: c.id,
    name: c.card.name,
    serialNumber: c.serialNumber,
    remainingSessions: c.remainingSessions,
    totalSessions: c.totalSessions,
    unpaidAmount: c.isPaid ? null : c.finalPrice,
    lastUsedAt: c.attendanceRecords[0]?.lessonPeriod.startTime ?? null,
  }));
}

/** How many periods the student attended this (Taipei) month. */
export async function monthAttendanceCount(studentId: number, now = new Date()): Promise<number> {
  const { start, end } = parseTaipeiMonthRange(toTaipeiMonthKey(now));
  return prisma.attendanceRecord.count({
    where: { studentId, lessonPeriod: { startTime: { gte: start, lt: end } } },
  });
}

// The lesson query loads the full style (the card rules need it); the wire
// shape stays the summary, whitelisted.
const pickSummary = (style: DanceStyleSummary | null): DanceStyleSummary | null =>
  style ? { id: style.id, name: style.name, color: style.color, hasLevels: style.hasLevels } : null;

type LessonForCardStatus = Parameters<typeof cardOptionsFor>[1];

/**
 * What a student can pay for one lesson with: their usable cards (same rules
 * and order as the attendance engine) and the lesson's cards they may buy now.
 */
async function lessonCardStatus(
  lesson: LessonForCardStatus,
  studentId: number,
  classroomId: number
): Promise<LessonCardStatus> {
  const sessionsPerAttendance = lesson.sessionsPerAttendance;
  const [student] = await fetchStudentsWithValidCards(
    [studentId],
    lesson.cards.map((lc) => lc.cardId),
    classroomId,
    sessionsPerAttendance
  );
  if (!student) return { sessionsPerAttendance, usable: [], autoPickId: null, buyable: [] };

  const { usable, autoPick } = cardOptionsFor(student, lesson);
  const levels = toDanceLevels(student.danceQualifications);

  return {
    sessionsPerAttendance,
    usable: usable.map((sc) => ({
      studentCardId: sc.id,
      name: sc.card.name,
      serialNumber: sc.serialNumber,
      remainingSessions: sc.remainingSessions,
      isPracticeCard: sc.card.isPracticeCard,
    })),
    autoPickId: autoPick?.id ?? null,
    buyable: lesson.cards
      .map((lc) => lc.card)
      .filter(
        (card) =>
          !card.expiredAt &&
          !card.isTrial &&
          card.sessions >= sessionsPerAttendance &&
          canBuyCard(card, levels, lesson).allowed
      )
      .sort((a, b) => a.price - b.price)
      .map((card) => ({
        cardId: card.id,
        name: card.name,
        sessions: card.sessions,
        price: card.price,
        isPracticeCard: card.isPracticeCard,
      })),
  };
}
