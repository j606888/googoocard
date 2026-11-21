import { useMemo } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetLessonPeriodStatsQuery,
  useGetLessonsQuery,
  type Lesson,
  type LessonSummary,
} from "@/store/slices/lessons";
import { termNumbers, termRangeLabel } from "../termLabels";
import { termOverview } from "./termPage";

export interface TermLink {
  lessonId: number;
  number: number;
  /** 「2026/06/07 – 07/26」 */
  range: string;
  running: boolean;
  totalPeriods: number;
}

/**
 * 「這一期」頁兩個外殼（手機／桌面）共用的資料：三格統計、每堂收入、同課種的其他期。
 * 人數沿用課程頁已經算好的 `headcounts`；收入另外問伺服器（`periodRevenue()`）。
 */
export const useTermPage = (lesson: Lesson | undefined, headcounts: Map<number, number>) => {
  const { data: stats } = useGetLessonPeriodStatsQuery(lesson?.id ?? skipToken);
  const groupId = lesson?.groupId ?? null;
  const { data: siblings } = useGetLessonsQuery(
    { tab: "all", sort: "nextSession", groupId },
    { skip: groupId === null }
  );

  return useMemo(() => {
    const lessons: LessonSummary[] = siblings?.lessons ?? [];
    const numbers = termNumbers(lessons);
    const terms: TermLink[] = lessons
      .map((term) => ({
        lessonId: term.id,
        number: numbers.get(term.id)!,
        range: termRangeLabel(term),
        running: term.status === "inProgress",
        totalPeriods: term.totalPeriods,
      }))
      .sort((a, b) => b.number - a.number);
    return {
      overview: lesson
        ? termOverview(lesson.periods ?? [], [...headcounts.values()], lesson.kind)
        : null,
      /** undefined = 還在抓。 */
      totalRevenue: stats?.totalRevenue,
      revenues: new Map(stats?.periods.map((period) => [period.periodId, period.revenue])),
      /** 同課種的各期，新的在前；沒歸課種是空的。 */
      terms,
      termNumber: lesson ? (numbers.get(lesson.id) ?? null) : null,
      /** 這一期的列表摘要——「開新一期」複製設定用。沒歸課種時是 null。 */
      summary: lesson ? (lessons.find((term) => term.id === lesson.id) ?? null) : null,
    };
  }, [lesson, headcounts, stats, siblings]);
};
