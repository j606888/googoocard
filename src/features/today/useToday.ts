"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetLessonAgendaQuery } from "@/store/slices/lessons";
import { useGetMeQuery, useGetMyLessonsQuery } from "@/store/slices/me";
import { useGetTodosQuery } from "@/store/slices/todos";
import { useClassroomGuard } from "@/hooks/useClassroomGuard";
import { isAdminRole } from "@/lib/roles";
import { useNow } from "../lessons/useLessonAgenda";
import { buildToday, collectToday, countToday, dayLabel, greeting, todoRows } from "./today";

// 學生會自己用 LINE 簽到、別的老師會點名：掛載與回到分頁時都重抓。
const LIVE = { refetchOnMountOrArgChange: true, refetchOnFocus: true } as const;

/**
 * 「今天」頁唯一的 hook：畫面只管排版，哪一堂是主角、數字怎麼算都在這裡和 `today.ts`。
 *
 * 誰看到什麼（2026-11-26）——不照角色名稱切，照「今天要做的事」疊：
 *  - 有自己的課（教的＋協助的）的人：我的課、這堂的準備、下課要收的錢、我的課的待處理
 *  - 管理員：再加全教室（今天每一堂的點名狀態、全教室的待處理）與追蹤（提醒類）
 *  - 小幫手：同老師，只是「下課要收的錢」排在待處理前面
 */
export const useToday = () => {
  const now = useNow();
  // 伺服器在 UTC、老師在台北：日期和問候語等掛上之後才用瀏覽器的時間算，
  // 不然 SSR 的「11/19 晚安」會跟畫面上的「11/20 早安」對不起來（hydration mismatch）。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { current, isLoading: classroomLoading } = useClassroomGuard();
  const isAdmin = isAdminRole(current?.role);
  const { data: me } = useGetMeQuery();
  const agenda = useGetLessonAgendaQuery(undefined, LIVE);
  const myLessons = useGetMyLessonsQuery(undefined, LIVE);
  const myTodos = useGetTodosQuery("mine", { refetchOnFocus: true });
  const allTodos = useGetTodosQuery("all", { refetchOnFocus: true, skip: !isAdmin });

  const view = useMemo(
    () => buildToday(agenda.data?.periods ?? [], now, agenda.data?.myTeacherId ?? null),
    [agenda.data, now]
  );

  const myPeriods = myLessons.data?.periods;
  const collect = useMemo(() => {
    if (!myTodos.data) return [];
    const todayLessonIds = new Set(
      (myPeriods ?? []).filter((p) => countToday([p], now) === 1).map((p) => p.lesson.id)
    );
    return collectToday(myTodos.data, now, todayLessonIds);
  }, [myTodos.data, myPeriods, now]);

  return {
    now,
    isLoading: !mounted || classroomLoading || agenda.isLoading,
    greeting: mounted ? greeting(now) : null,
    dateLabel: mounted ? dayLabel(now) : null,
    name: me?.name ?? null,
    isAdmin,
    /** 小幫手多半負責收錢：「下課要收的錢」排在待處理前面。 */
    collectFirst: current?.role === "assistant",
    /** 連著老師資料的人才有「今天教幾堂」；沒教課的成員是 null。 */
    todayCount: myLessons.data?.teacher ? countToday(myLessons.data.periods, now) : null,
    view,
    /** 我的課的待處理（沒有自己的課的人是空的）。 */
    todoRows: myTodos.data ? todoRows(myTodos.data) : [],
    /** 全教室的待處理——只有管理員有。 */
    allTodoRows: allTodos.data ? todoRows(allTodos.data) : [],
    collect,
  };
};
