import { format } from "date-fns";
import type { LessonSummary } from "@/store/slices/lessons";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 一期的上課時段：「週日 14:00」。從第一堂算——舊資料沒有「週日班」，星期幾用算的。 */
export const slotLabel = (lesson: Pick<LessonSummary, "firstPeriodStart">): string | null => {
  if (!lesson.firstPeriodStart) return null;
  const start = new Date(lesson.firstPeriodStart);
  return `週${WEEKDAYS[start.getDay()]} ${format(start, "HH:mm")}`;
};

/** 一期的期間：「2026/06/07 – 07/26」；跨年就兩邊都寫年。 */
export const termRangeLabel = (
  lesson: Pick<LessonSummary, "firstPeriodStart" | "lastPeriodEnd">
): string => {
  if (!lesson.firstPeriodStart) return "還沒排時段";
  const start = new Date(lesson.firstPeriodStart);
  if (!lesson.lastPeriodEnd) return format(start, "yyyy/MM/dd");
  const end = new Date(lesson.lastPeriodEnd);
  return `${format(start, "yyyy/MM/dd")} – ${format(
    end,
    end.getFullYear() === start.getFullYear() ? "MM/dd" : "yyyy/MM/dd"
  )}`;
};

/** 同一個課種裡各期的「第幾期」：照開始日由舊到新，沒排時段的排最後。 */
export const termNumbers = (
  lessons: Pick<LessonSummary, "id" | "firstPeriodStart">[]
): Map<number, number> => {
  const startOf = (l: Pick<LessonSummary, "firstPeriodStart">) =>
    l.firstPeriodStart ? new Date(l.firstPeriodStart).getTime() : Infinity;
  const ordered = [...lessons].sort((a, b) => startOf(a) - startOf(b) || a.id - b.id);
  return new Map(ordered.map((lesson, index) => [lesson.id, index + 1]));
};
