import { addDays, isBefore, startOfDay } from "date-fns";
import { LessonSummary } from "@/store/slices/lessons";

/**
 * 持續開課的「＋下一堂」規則（純函式）。課種 → 期的分組在 `lessonSeries.ts`。
 */

/**
 * 持續開課、沒被手動結束、而且沒有任何排好的下一堂 —— 列表要給「＋下一堂」。
 * 有待點名的時段時先點名（`lessonRowAction` 的優先序）。
 */
export const needsNextPeriod = (lesson: LessonSummary): boolean =>
  lesson.kind === "ongoing" && !lesson.endedAt && lesson.nextSessionDate === null;

/**
 * 「＋下一堂」的預設時段：沿用上一堂的星期與時間，往後推整週，
 * 推到今天或之後為止（停了幾週的課不會預設排在過去）。沒有上一堂時回 null。
 */
export const nextPeriodDefault = (
  lastPeriodStart: string | null,
  lastPeriodEnd: string | null,
  now: Date
): { startTime: Date; endTime: Date } | null => {
  if (!lastPeriodStart || !lastPeriodEnd) return null;
  let startTime = new Date(lastPeriodStart);
  let endTime = new Date(lastPeriodEnd);
  const today = startOfDay(now);
  do {
    startTime = addDays(startTime, 7);
    endTime = addDays(endTime, 7);
  } while (isBefore(startTime, today));
  return { startTime, endTime };
};
