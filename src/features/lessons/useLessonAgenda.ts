"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetLessonAgendaQuery, type AgendaPeriod } from "@/store/slices/lessons";
import { isMyLesson } from "./lessonSeries";

/** 每 30 秒換一次 now：「還有 40 分鐘」會走、下課後那一列自己換狀態。 */
const TICK_MS = 30_000;

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
};

export type AgendaState = "overdue" | "inClass" | "upcoming";
export interface AgendaRow {
  period: AgendaPeriod;
  state: AgendaState;
}

const ORDER: Record<AgendaState, number> = { overdue: 0, inClass: 1, upcoming: 2 };

/** 還沒點名（舊的在前）→ 上課中 → 接下來 7 天。已點名、已下課的不列。 */
export const agendaRows = (periods: AgendaPeriod[], now: Date): AgendaRow[] => {
  const t = now.getTime();
  const rows: AgendaRow[] = [];
  for (const period of periods) {
    const start = new Date(period.startTime).getTime();
    const end = new Date(period.endTime).getTime();
    if (start <= t && t < end) rows.push({ period, state: "inClass" });
    else if (start > t) rows.push({ period, state: "upcoming" });
    else if (!period.attendanceTakenAt) rows.push({ period, state: "overdue" });
  }
  return rows.sort(
    (a, b) =>
      ORDER[a.state] - ORDER[b.state] ||
      new Date(a.period.startTime).getTime() - new Date(b.period.startTime).getTime() ||
      a.period.id - b.period.id
  );
};

/**
 * 課程列表的「接下來」。學生會自己用 LINE 簽到，所以掛載與回到分頁時都重抓。
 * `scope` 篩成「我的課」（我教的＋我當小幫手的）與單一分部。
 *
 * `fallbackToAll`：7 天內完全沒有自己的課（例如只負責收款、沒被排進任何課的
 * 小幫手）時，「我的課」改看全部，免得一打開就是空畫面。回傳的 `mine` 是實際
 * 套用的範圍，課程清單和分段控制都跟著它。
 */
export const useLessonAgenda = (scope: {
  mine: boolean;
  locationId: number | null;
  fallbackToAll?: boolean;
}) => {
  const now = useNow();
  const { data, isLoading } = useGetLessonAgendaQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const myTeacherId = data?.myTeacherId ?? null;

  return useMemo(() => {
    const all = agendaRows(data?.periods ?? [], now);
    const hasOwn =
      myTeacherId !== null && all.some(({ period }) => isMyLesson(period.lesson, myTeacherId));
    const mine = scope.mine && !(scope.fallbackToAll && data && !hasOwn);
    const rows = all.filter(
      ({ period }) =>
        (scope.locationId === null || period.lesson.location?.id === scope.locationId) &&
        (!mine || myTeacherId === null || isMyLesson(period.lesson, myTeacherId))
    );
    return { now, isLoading, myTeacherId, mine, rows, hiddenCount: all.length - rows.length };
  }, [data, isLoading, now, myTeacherId, scope.mine, scope.locationId, scope.fallbackToAll]);
};
