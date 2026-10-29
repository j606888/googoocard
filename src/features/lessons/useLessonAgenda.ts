"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetLessonAgendaQuery } from "@/store/slices/lessons";
import { overduePeriods, pickHero } from "./lessonSchedule";

/** 每 30 秒換一次 now：「還有 40 分鐘」會走、下課後主角自己換成下一堂。 */
const TICK_MS = 30_000;

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
};

/**
 * 課程列表頂端：主角（上課中／下一堂）與還沒點名的時段。
 * 學生會自己用 LINE 簽到，所以掛載與回到分頁時都重抓。
 */
export const useLessonAgenda = () => {
  const now = useNow();
  const { data, isLoading } = useGetLessonAgendaQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  return useMemo(() => {
    const periods = data?.periods ?? [];
    const myTeacherId = data?.myTeacherId ?? null;
    const hero = pickHero(
      periods,
      now,
      myTeacherId === null ? undefined : (p) => p.lesson.teachers.some((t) => t.id === myTeacherId)
    );
    return {
      now,
      isLoading,
      hero,
      overdue: overduePeriods(periods, now, hero?.period.id ?? null),
    };
  }, [data, isLoading, now]);
};
