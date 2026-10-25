import { Classroom } from "@prisma/client";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import prisma from "@/lib/prisma";
import { toTaipeiDateKey, parseTaipeiDateRange } from "@/lib/taipei-date";
import { canBuyCard, toDanceLevels } from "@/domains/qualification";
import { cardOptionsFor } from "@/domains/attendance/attendance.service";
import { fetchStudentsWithValidCards } from "@/service/lessonCards";
import { isReturningStudent, selfServicePrice } from "@/service/trial";

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

/** One of the lesson's cards the student may buy on the spot, at their price. */
export interface BuyableCardOption {
  cardId: number;
  name: string;
  sessions: number;
  /** What this student pays (trial cards are free for 舊生). */
  price: number;
  isTrial: boolean;
  isPracticeCard: boolean;
}

export interface LessonCardStatus {
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

export interface TodayLessons {
  date: string;
  today: TodayLesson[];
  nextLesson: { lessonName: string; startTime: Date } | null;
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
 * today, `nextLesson` carries the next upcoming period so the UI can show
 * 「下次上課」.
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

  const returning = studentId ? await isReturningStudent(studentId) : false;

  const today: TodayLesson[] = await Promise.all(
    lessons.map(async (lesson) => ({
      lessonId: lesson.id,
      lessonName: lesson.name,
      danceStyle: pickSummary(lesson.danceStyle),
      periods: lesson.periods.map((period) => ({
        periodId: period.id,
        startTime: period.startTime,
        endTime: period.endTime,
        alreadyChecked: checkedIds.has(period.id),
      })),
      ...(studentId
        ? { cardStatus: await lessonCardStatus(lesson, studentId, classroomId, returning) }
        : {}),
    }))
  );

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
  classroomId: number,
  returning: boolean
): Promise<LessonCardStatus> {
  const [student] = await fetchStudentsWithValidCards(
    [studentId],
    lesson.cards.map((lc) => lc.cardId),
    classroomId
  );
  if (!student) return { usable: [], autoPickId: null, buyable: [] };

  const { usable, autoPick } = cardOptionsFor(student, lesson);
  const levels = toDanceLevels(student.danceQualifications);

  return {
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
      .filter((card) => !card.expiredAt && canBuyCard(card, levels, lesson).allowed)
      // Trial first (the obvious choice for a newcomer), then cheapest.
      .sort((a, b) => Number(b.isTrial) - Number(a.isTrial) || a.price - b.price)
      .map((card) => ({
        cardId: card.id,
        name: card.name,
        sessions: card.sessions,
        price: selfServicePrice(card, returning),
        isTrial: card.isTrial,
        isPracticeCard: card.isPracticeCard,
      })),
  };
}
