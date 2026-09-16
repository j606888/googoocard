import prisma from "@/lib/prisma";
import { endOfDay, isSameDay } from "date-fns";

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
  /** How many periods are due (start <= end of today) but not yet checked — drives the ⚠️. */
  dueForAttendanceCount: number;
  /**
   * The period the 點名 CTA opens: **today's due period if there is one**, otherwise the
   * earliest due one. Today-first because a stale unchecked period (rained-off class that
   * was never deleted) used to silently drag every later 點名 onto the wrong date — it
   * corrupted two weeks of Bailamore attendance before anyone noticed. The backlog is
   * still surfaced, as `dueForAttendanceCount` + `dueForAttendanceIsBacklog`, not by
   * hijacking the CTA.
   */
  dueForAttendancePeriodId: number | null;
  /** Start of that same period — the date shown on the 點名 CTA. */
  dueForAttendanceDate: Date | null;
  /** End of that same period — paired with dueForAttendanceDate for a "14:00–15:00" style display. */
  dueForAttendanceEndTime: Date | null;
  /** True when the CTA target is *not* today's period — the UI must show its date, not just its time. */
  dueForAttendanceIsBacklog: boolean;
  /** End of the next upcoming period — paired with nextSessionDate. */
  nextSessionEndTime: Date | null;
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

  // Today first, earliest-overdue only as a fallback (see LessonPeriodSummary).
  const dueTarget = due.find((p) => isSameDay(p.startTime, now)) ?? due[0] ?? null;

  const lastPeriod = parsed.reduce<(typeof parsed)[number] | null>(
    (latest, p) => (!latest || p.endTime > latest.endTime ? p : latest),
    null
  );

  return {
    totalPeriods,
    attendedCount,
    allAttendanceChecked: totalPeriods > 0 && attendedCount === totalPeriods,
    nextSessionDate: nextSession?.startTime ?? null,
    nextSessionEndTime: nextSession?.endTime ?? null,
    nextSessionPeriodId: nextSession?.id ?? null,
    dueForAttendanceCount: due.length,
    dueForAttendancePeriodId: dueTarget?.id ?? null,
    dueForAttendanceDate: dueTarget?.startTime ?? null,
    dueForAttendanceEndTime: dueTarget?.endTime ?? null,
    dueForAttendanceIsBacklog: dueTarget ? !isSameDay(dueTarget.startTime, now) : false,
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
