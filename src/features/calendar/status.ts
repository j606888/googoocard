import { endOfDay } from "date-fns";
import { CalendarPeriod } from "@/store/slices/lessons";

export type SessionState = "taken" | "due" | "upcoming";

/**
 * Attendance state of a single session. "due" mirrors the same condition used
 * by summarizeLessonPeriods (src/service/lesson.ts): not yet taken and started
 * on or before the end of today.
 */
export const sessionState = (
  period: CalendarPeriod,
  now: Date
): SessionState => {
  if (period.attendanceTaken) return "taken";
  if (new Date(period.startTime).getTime() <= endOfDay(now).getTime()) {
    return "due";
  }
  return "upcoming";
};
