import { differenceInCalendarDays, format } from "date-fns";
import type { AgendaPeriod } from "@/store/slices/lessons";
import type { Todos } from "@/store/slices/todos";
import { agendaRows, type AgendaRow } from "../lessons/useLessonAgenda";
import { isMyLesson } from "../lessons/lessonSeries";
import { relativeDayLabel, timeLeftLabel } from "../lessons/lessonSchedule";

/**
 * 「今天」頁的純推導：哪一堂是主角、今天還有哪些、哪些還沒點名、待處理怎麼講。
 * 資料是 `GET /api/lessons/agenda`（同課程列表），元件每 30 秒換一次 `now`。
 */

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export const greeting = (now: Date): string => {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return "早安";
  if (hour >= 11 && hour < 18) return "午安";
  return "晚安";
};

/** 「11/26（四）」 */
export const dayLabel = (date: Date): string =>
  `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）`;

const isSameDay = (iso: string, now: Date) => differenceInCalendarDays(new Date(iso), now) === 0;

export interface TodayView {
  /** 有自己的課就只看自己的（我教的＋我當小幫手的），沒有才看全教室。 */
  scope: "mine" | "all";
  /** 主角：上課中還沒點名的 → 不然就是下一堂。沒有排課是 null。 */
  hero: AgendaRow | null;
  /** 主角是不是今天的課——只有今天的課才給「開始點名」，免得點到別天。 */
  heroIsToday: boolean;
  /** 今天其他還沒結束的課（含上課中已點名的）。 */
  later: AgendaRow[];
  /** 已經下課、還沒點名的，舊的在前。 */
  overdue: AgendaRow[];
}

export const buildToday = (
  periods: AgendaPeriod[],
  now: Date,
  myTeacherId: number | null
): TodayView => {
  const all = agendaRows(periods, now);
  const own =
    myTeacherId === null ? [] : all.filter(({ period }) => isMyLesson(period.lesson, myTeacherId));
  const scope = own.length > 0 ? "mine" : "all";
  const rows = scope === "mine" ? own : all;

  const overdue = rows.filter((row) => row.state === "overdue");
  const active = rows.filter((row) => row.state !== "overdue");
  const hero =
    active.find((row) => row.state === "inClass" && !row.period.attendanceTakenAt) ??
    active.find((row) => row.state === "upcoming") ??
    null;

  return {
    scope,
    hero,
    heroIsToday: hero !== null && isSameDay(hero.period.startTime, now),
    later: active.filter((row) => row !== hero && isSameDay(row.period.startTime, now)),
    overdue,
  };
};

/** 主角卡上的小標：「上課中 · 還有 20 分鐘」「下一堂 · 還有 42 分鐘」「下一堂 · 明天（五）」。 */
export const heroBadge = ({ period, state }: AgendaRow, now: Date): string => {
  if (state === "inClass") return `上課中 · ${timeLeftLabel(new Date(period.endTime), now)}`;
  const start = new Date(period.startTime);
  return isSameDay(period.startTime, now)
    ? `下一堂 · ${timeLeftLabel(start, now)}`
    : `下一堂 · ${relativeDayLabel(start, now)}`;
};

/** 「第 6 期 · 第 3 / 6 堂」；持續開課的課沒有總堂數，沒歸課種的沒有期數。 */
export const termProgressLabel = (period: AgendaPeriod): string => {
  const { termNumber, kind, totalPeriods } = period.lesson;
  const session =
    kind === "fixed" && totalPeriods > 1
      ? `第 ${period.number} / ${totalPeriods} 堂`
      : `第 ${period.number} 堂`;
  return termNumber ? `第 ${termNumber} 期 · ${session}` : session;
};

/** 今天有幾堂自己的課（上完的也算）。資料是 `GET /api/me/lessons`。 */
export const countToday = (periods: { startTime: string }[], now: Date): number =>
  periods.filter((period) => isSameDay(period.startTime, now)).length;

export interface TodoRow {
  key: "unpaid" | "unbound" | "renewal" | "reminders";
  count: number;
  /** 數字後面那句話：「筆未付款」「位學生該續卡」。 */
  text: string;
}

/**
 * 今天頁「待處理」的列：一種一列，數字獨立出來（琥珀大字），各自點得進去。
 * 「還沒點名」不在這裡——它來自課程
 * 議程（`buildToday().overdue`），跟課程列表頂部的提醒同一個定義。
 */
export const todoRows = (
  todos: Pick<
    Todos,
    "unpaidCards" | "unpaidDropIns" | "unpaidEnrollments" | "unboundAttendance" | "needsRenewal" | "reminderCount"
  >
): TodoRow[] => {
  const unpaid =
    todos.unpaidCards.length + (todos.unpaidDropIns?.length ?? 0) + (todos.unpaidEnrollments?.length ?? 0);
  const rows: TodoRow[] = [];
  if (unpaid > 0) rows.push({ key: "unpaid", count: unpaid, text: "筆未付款" });
  if (todos.unboundAttendance.length > 0)
    rows.push({ key: "unbound", count: todos.unboundAttendance.length, text: "筆點名沒有課卡" });
  if (todos.needsRenewal.length > 0)
    rows.push({ key: "renewal", count: todos.needsRenewal.length, text: "位學生該續卡" });
  const others = todos.reminderCount - todos.needsRenewal.length;
  if (others > 0) rows.push({ key: "reminders", count: others, text: "件其他提醒" });
  return rows;
};
