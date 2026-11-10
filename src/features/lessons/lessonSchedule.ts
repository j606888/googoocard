import { differenceInCalendarDays, format } from "date-fns";

/**
 * 課程列表「接下來」與課程頁副標題用的時間標籤（純推導）。
 * 全部吃 `now` 參數——元件每分鐘更新一次 now，畫面自己會從「下一堂」換成「上課中」。
 *
 * 資料來源是 `GET /api/lessons/agenda`（`src/service/lessonAgenda.ts`），
 * 哪一堂算還沒點名／上課中／接下來，在 `useLessonAgenda.ts` 的 `agendaRows()`。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export interface ScheduledPeriod {
  id: number;
  startTime: string;
  endTime: string;
  attendanceTakenAt: string | null;
}

/** 「今天」「明天（五）」「11/2（日）」。 */
export const relativeDayLabel = (date: Date, now: Date): string => {
  const days = differenceInCalendarDays(date, now);
  if (days === 0) return "今天";
  const weekday = `（${WEEKDAYS[date.getDay()]}）`;
  if (days === 1) return `明天${weekday}`;
  return `${format(date, "M/d")}${weekday}`;
};

/** 進行中的課那一欄的下一堂：「今天 20:00」「明天」「11/2（日）」。 */
export const nextDateLabel = (date: Date, now: Date): string => {
  const days = differenceInCalendarDays(date, now);
  if (days === 0) return `今天 ${format(date, "HH:mm")}`;
  if (days === 1) return "明天";
  return `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）`;
};

/** 還沒點名那一列的「7 天前」。 */
export const agoLabel = (date: Date, now: Date): string => {
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
};

/** 上課中的倒數：「還有 40 分鐘」「還有 1 小時 20 分」。 */
export const timeLeftLabel = (end: Date, now: Date): string => {
  const minutes = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `還有 ${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `還有 ${hours} 小時` : `還有 ${hours} 小時 ${rest} 分`;
};

/** 「第 4 堂」，固定堂數的課上到最後一堂時加「（最後一堂）」。 */
export const periodOrdinalLabel = (
  number: number,
  total: number,
  kind: "fixed" | "ongoing"
): string =>
  kind === "fixed" && total > 1 && number === total
    ? `第 ${number} 堂（最後一堂）`
    : `第 ${number} 堂`;

/**
 * 每個時段都落在同一個星期幾、同一個時間時，回「每週五 20:00–21:00」；
 * 不規則（或還沒排時段）回 null，呼叫端只顯示老師。
 */
export const weeklyScheduleLabel = (
  periods: { startTime: string; endTime: string }[]
): string | null => {
  if (periods.length === 0) return null;
  const keys = new Set(
    periods.map((p) => {
      const start = new Date(p.startTime);
      return `${start.getDay()} ${format(start, "HH:mm")}–${format(new Date(p.endTime), "HH:mm")}`;
    })
  );
  if (keys.size !== 1) return null;
  const start = new Date(periods[0].startTime);
  return `每週${WEEKDAYS[start.getDay()]} ${format(start, "HH:mm")}–${format(
    new Date(periods[0].endTime),
    "HH:mm"
  )}`;
};
