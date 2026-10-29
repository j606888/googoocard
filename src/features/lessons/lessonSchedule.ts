import { differenceInCalendarDays, format } from "date-fns";

/**
 * 課程列表頂端（下一堂／上課中、還沒點名）與課程頁副標題的純推導。
 * 全部吃 `now` 參數——元件每分鐘更新一次 now，畫面自己會從「下一堂」換成「上課中」。
 *
 * 資料來源是 `GET /api/lessons/agenda`（`src/service/lessonAgenda.ts`），
 * 伺服器只負責「撈出可能相關的時段」，挑哪一堂當主角在這裡決定。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export interface ScheduledPeriod {
  id: number;
  startTime: string;
  endTime: string;
  attendanceTakenAt: string | null;
}

export type AgendaHero<P extends ScheduledPeriod> =
  | { kind: "inClass"; period: P }
  | { kind: "next"; period: P }
  | null;

const byStart = (a: ScheduledPeriod, b: ScheduledPeriod) =>
  new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || a.id - b.id;

/** 現在正在上的那一堂（開始 ≤ now < 結束）；兩堂同時在上時取先開始的。 */
export const inClassPeriod = <P extends ScheduledPeriod>(periods: P[], now: Date): P | null => {
  const t = now.getTime();
  return (
    [...periods]
      .filter((p) => new Date(p.startTime).getTime() <= t && t < new Date(p.endTime).getTime())
      .sort(byStart)[0] ?? null
  );
};

/** 還沒開始的最近一堂。永遠不會是過去的時段（舊的 NextCell 會把逾期那堂當成「下一堂」）。 */
export const nextPeriod = <P extends ScheduledPeriod>(periods: P[], now: Date): P | null => {
  const t = now.getTime();
  return [...periods].filter((p) => new Date(p.startTime).getTime() > t).sort(byStart)[0] ?? null;
};

const heroFrom = <P extends ScheduledPeriod>(periods: P[], now: Date): AgendaHero<P> => {
  const current = inClassPeriod(periods, now);
  if (current) return { kind: "inClass", period: current };
  const next = nextPeriod(periods, now);
  return next ? { kind: "next", period: next } : null;
};

/**
 * 列表頂端的主角：上課中優先，沒有就是下一堂；都沒有回 null。
 * 有 `isMine`（成員連著老師）時先只看自己教的課，自己沒課可挑才看全教室。
 */
export const pickHero = <P extends ScheduledPeriod>(
  periods: P[],
  now: Date,
  isMine?: (period: P) => boolean
): AgendaHero<P> => (isMine && heroFrom(periods.filter(isMine), now)) || heroFrom(periods, now);

/**
 * 還沒點名：已經開始、還沒點名的時段，舊的在前。主角那一堂（上課中）不重複列；
 * 今天稍後才開始的不算。
 */
export const overduePeriods = <P extends ScheduledPeriod>(
  periods: P[],
  now: Date,
  heroId: number | null
): P[] => {
  const t = now.getTime();
  return periods
    .filter(
      (p) => !p.attendanceTakenAt && new Date(p.startTime).getTime() <= t && p.id !== heroId
    )
    .sort(byStart);
};

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
