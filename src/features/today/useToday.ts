"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetLessonAgendaQuery, useGetRecentPeriodsQuery } from "@/store/slices/lessons";
import { useGetMeQuery, useGetMyLessonsQuery } from "@/store/slices/me";
import { useGetTodosQuery } from "@/store/slices/todos";
import { useClassroomGuard } from "@/hooks/useClassroomGuard";
import { roleLabel } from "@/lib/roles";
import { useNow } from "../lessons/useLessonAgenda";
import { buildToday, countToday, dayLabel, greeting, todoSummary } from "./today";

// 學生會自己用 LINE 簽到、別的老師會點名：掛載與回到分頁時都重抓。
const LIVE = { refetchOnMountOrArgChange: true, refetchOnFocus: true } as const;

/** 「今天」頁唯一的 hook：畫面只管排版，哪一堂是主角、數字怎麼算都在這裡和 `today.ts`。 */
export const useToday = () => {
  const now = useNow();
  // 伺服器在 UTC、老師在台北：日期和問候語等掛上之後才用瀏覽器的時間算，
  // 不然 SSR 的「11/19 晚安」會跟畫面上的「11/20 早安」對不起來（hydration mismatch）。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { current, isLoading: classroomLoading } = useClassroomGuard();
  const { data: me } = useGetMeQuery();
  const agenda = useGetLessonAgendaQuery(undefined, LIVE);
  const myLessons = useGetMyLessonsQuery(undefined, LIVE);
  const todos = useGetTodosQuery(undefined, { refetchOnFocus: true });
  const recent = useGetRecentPeriodsQuery(undefined, LIVE);

  const view = useMemo(
    () => buildToday(agenda.data?.periods ?? [], now, agenda.data?.myTeacherId ?? null),
    [agenda.data, now]
  );

  return {
    now,
    isLoading: !mounted || classroomLoading || agenda.isLoading,
    greeting: mounted ? greeting(now) : null,
    dateLabel: mounted ? dayLabel(now) : null,
    name: me?.name ?? null,
    roleLabel: current ? roleLabel(current.role) : null,
    /** 連著老師資料的人才有「今天教幾堂」；沒教課的成員是 null。 */
    todayCount: myLessons.data?.teacher ? countToday(myLessons.data.periods, now) : null,
    view,
    todo: todos.data ? todoSummary(todos.data) : null,
    recent: recent.data ?? [],
    recentLoading: recent.isLoading,
  };
};
