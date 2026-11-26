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

/** 今天的一堂課與它的點名狀態（管理員的「全教室」區塊）。 */
export interface TodayLesson {
  period: AgendaPeriod;
  status: "taken" | "inClass" | "overdue" | "upcoming";
}

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
  /** 全教室：已經下課、還沒點名的（不分是不是我的課）。 */
  allOverdue: AgendaRow[];
  /** 全教室今天的每一堂（上完的也在），照時間排。 */
  allToday: TodayLesson[];
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

  const t = now.getTime();
  const allToday = periods
    .filter((period) => isSameDay(period.startTime, now))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || a.id - b.id)
    .map((period): TodayLesson => {
      const start = new Date(period.startTime).getTime();
      const end = new Date(period.endTime).getTime();
      const status = period.attendanceTakenAt
        ? "taken"
        : start > t
          ? "upcoming"
          : t < end
            ? "inClass"
            : "overdue";
      return { period, status };
    });

  return {
    scope,
    hero,
    heroIsToday: hero !== null && isSameDay(hero.period.startTime, now),
    later: active.filter((row) => row !== hero && isSameDay(row.period.startTime, now)),
    overdue,
    allOverdue: all.filter((row) => row.state === "overdue"),
    allToday,
  };
};

/**
 * 主角卡的「這堂的準備」：誰會來、來了幾個。只列有數字的；全部是 0 就退回名單人數。
 * 「整期 6 · 預計會來 3 · 體驗 2 · 已自助簽到 4」
 */
export const prepParts = (period: AgendaPeriod): string[] => {
  const arrived = period.attendeeIds.length;
  const parts = [
    period.enrolledCount > 0 && `整期 ${period.enrolledCount}`,
    period.bookingCount > 0 && `預計會來 ${period.bookingCount}`,
    period.trialCount > 0 && `體驗 ${period.trialCount}`,
    period.selfCheckInCount > 0
      ? `已自助簽到 ${period.selfCheckInCount}`
      : arrived > 0 && `已簽到 ${arrived}`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts : [`名單 ${period.lesson.studentCount} 位學生`];
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
  key: "unpaid" | "unbound" | "renewal" | "trial" | "duplicates" | "claims";
  count: number;
  /** 數字後面那句話：「筆未付款」「位學生已經沒卡」。 */
  text: string;
  /** 點下去鈴鐺開哪一頁：要處理（要補的）或提醒（要追蹤的）。 */
  tab: "urgent" | "reminders";
}

type TodoCounts = Pick<
  Todos,
  | "unpaidCards"
  | "unpaidDropIns"
  | "unpaidEnrollments"
  | "unboundAttendance"
  | "needsRenewal"
  | "trialFollowUps"
  | "possibleDuplicates"
  | "lineSelfClaims"
>;

/**
 * 今天頁「待處理」的列：一種一列，數字獨立出來（琥珀大字），各自點得進去。
 * 給的是哪個範圍的待處理（我的課／全教室）就算哪個範圍。
 * 「還沒點名」不在這裡——它來自課程議程（`buildToday().overdue`），
 * 跟課程列表頂部的提醒同一個定義。
 */
export const todoRows = (todos: TodoCounts): TodoRow[] => {
  const unpaid =
    todos.unpaidCards.length + (todos.unpaidDropIns?.length ?? 0) + (todos.unpaidEnrollments?.length ?? 0);
  const all: TodoRow[] = [
    { key: "unpaid", count: unpaid, text: "筆未付款", tab: "urgent" },
    { key: "unbound", count: todos.unboundAttendance.length, text: "筆點名沒有課卡", tab: "urgent" },
    { key: "renewal", count: todos.needsRenewal.length, text: "位學生已經沒卡", tab: "reminders" },
    { key: "trial", count: todos.trialFollowUps.length, text: "位體驗後還沒買卡", tab: "reminders" },
    { key: "duplicates", count: todos.possibleDuplicates.length, text: "組同名學員可能重複", tab: "reminders" },
    { key: "claims", count: todos.lineSelfClaims?.length ?? 0, text: "位學生自己綁了 LINE，等你確認", tab: "reminders" },
  ];
  return all.filter((row) => row.count > 0);
};

/** 「下課要收的錢」的一筆：今天的課帶出來、還沒收的錢。 */
export type CollectItem = {
  key: string;
  student: Todos["unpaidCards"][number]["student"];
  /** 「10 堂卡」「單堂 · 學生價」「Salsa 初階 整期」 */
  label: string;
  amount: number;
} & (
  | { kind: "card"; studentCardId: number; serialNumber: number }
  | { kind: "enrollment"; enrollmentId: number }
  /** 單堂在點名結果頁收（可以當場改價）。 */
  | { kind: "dropIn"; href: string }
);

/**
 * 今天的課要收的錢，從（我的課範圍的）待處理挑出來：
 *  - 單堂：那堂課是今天的
 *  - 課卡：今天買的，或今天被扣過（課卡沒記在哪堂課買的）
 *  - 整期：那門課今天有上（`todayLessonIds`）
 */
export const collectToday = (
  todos: Pick<Todos, "unpaidCards" | "unpaidDropIns" | "unpaidEnrollments">,
  now: Date,
  todayLessonIds: ReadonlySet<number>
): CollectItem[] => [
  ...todos.unpaidCards
    .filter(
      (card) =>
        isSameDay(card.createdAt, now) || (card.usedIn ?? []).some((use) => isSameDay(use.startTime, now))
    )
    .map(
      (card): CollectItem => ({
        key: `card-${card.id}`,
        kind: "card",
        student: card.student,
        label: card.cardName,
        amount: card.finalPrice,
        studentCardId: card.id,
        serialNumber: card.serialNumber,
      })
    ),
  ...(todos.unpaidDropIns ?? [])
    .filter((charge) => isSameDay(charge.lessonPeriodStartTime, now))
    .map(
      (charge): CollectItem => ({
        key: `dropin-${charge.id}`,
        kind: "dropIn",
        student: charge.student,
        label: ["單堂", charge.optionName].filter(Boolean).join(" · "),
        amount: charge.amount,
        href: `/lessons/${charge.lessonId}/periods/${charge.lessonPeriodId}/check-success`,
      })
    ),
  ...(todos.unpaidEnrollments ?? [])
    .filter((enrollment) => todayLessonIds.has(enrollment.lessonId))
    .map(
      (enrollment): CollectItem => ({
        key: `enrollment-${enrollment.id}`,
        kind: "enrollment",
        student: enrollment.student,
        label: `${enrollment.lessonName} 整期`,
        amount: enrollment.price,
        enrollmentId: enrollment.id,
      })
    ),
];
