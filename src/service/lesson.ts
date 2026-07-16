import prisma from "@/lib/prisma";
import { endOfDay } from "date-fns";

type SummarizablePeriod = {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  attendanceTakenAt: Date | string | null;
};

export interface LessonPeriodSummary {
  totalPeriods: number;
  attendedCount: number;
  allAttendanceChecked: boolean;
  /** Earliest period starting strictly after `now` — the informational "next class" date. */
  nextSessionDate: Date | null;
  nextSessionPeriodId: number | null;
  /** Periods already due (start <= end of today) but not yet checked — drives the 點名 CTA / ⚠️. */
  dueForAttendanceCount: number;
  dueForAttendancePeriodId: number | null;
  /** Start of the earliest due period — the date shown on the 點名 CTA. */
  dueForAttendanceDate: Date | null;
  lastPeriodStart: Date | null;
  lastPeriodEnd: Date | null;
}

/**
 * Pure derivation of everything the lessons list needs from a lesson's periods.
 * Shared by the list API (payload) and refreshLesson (status/endAt) so the
 * "finished / next / due" logic lives in exactly one place.
 */
export const summarizeLessonPeriods = (
  periods: SummarizablePeriod[],
  now: Date
): LessonPeriodSummary => {
  const todayEnd = endOfDay(now);
  const parsed = periods.map((p) => ({
    id: p.id,
    startTime: new Date(p.startTime),
    endTime: new Date(p.endTime),
    attendanceTaken: Boolean(p.attendanceTakenAt),
  }));

  const totalPeriods = parsed.length;
  const attendedCount = parsed.filter((p) => p.attendanceTaken).length;

  const byStartAsc = [...parsed].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  const nextSession = byStartAsc.find((p) => p.startTime.getTime() > now.getTime());

  const due = byStartAsc.filter(
    (p) => !p.attendanceTaken && p.startTime.getTime() <= todayEnd.getTime()
  );

  const lastPeriod = parsed.reduce<(typeof parsed)[number] | null>(
    (latest, p) => (!latest || p.endTime > latest.endTime ? p : latest),
    null
  );

  return {
    totalPeriods,
    attendedCount,
    allAttendanceChecked: totalPeriods > 0 && attendedCount === totalPeriods,
    nextSessionDate: nextSession?.startTime ?? null,
    nextSessionPeriodId: nextSession?.id ?? null,
    dueForAttendanceCount: due.length,
    dueForAttendancePeriodId: due[0]?.id ?? null,
    dueForAttendanceDate: due[0]?.startTime ?? null,
    lastPeriodStart: lastPeriod?.startTime ?? null,
    lastPeriodEnd: lastPeriod?.endTime ?? null,
  };
};

export const refreshLesson = async (lessonId: number) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
  });

  if (!lesson) throw new Error("Lesson not found");

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      lessonId,
    },
  });

  const summary = summarizeLessonPeriods(periods, new Date());

  if (summary.lastPeriodEnd) {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        endAt: summary.lastPeriodEnd,
        status: summary.allAttendanceChecked ? "finished" : "inProgress",
      },
    });
  }
};
