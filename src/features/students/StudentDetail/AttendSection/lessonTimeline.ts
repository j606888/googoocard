import { addWeeks, differenceInCalendarWeeks, startOfWeek } from "date-fns";
import type { LessonAttendance } from "@/store/slices/students";

/**
 * 依課程的時間軸：每門課一列、每週一格，所有課共用同一條週軸，
 * 才看得出「哪門課什麼時候開始掉、什麼時候回來」。
 */

/** 時間軸最多畫幾週（含本週）；更早的課在列上改顯示日期範圍。 */
export const TIMELINE_MAX_WEEKS = 36;

type Slot = LessonAttendance["studentAttendances"][number];

export type PeriodStatus = "attended" | "absent" | "unchecked";

/** 出席（含自助簽到待定案）／老師點過名但沒來＝缺席／還沒點名。 */
export function periodStatus(slot: Pick<Slot, "studentAttend" | "periodAttendantCheck">): PeriodStatus {
  if (slot.studentAttend) return "attended";
  if (slot.periodAttendantCheck) return "absent";
  return "unchecked";
}

export interface LessonSummary {
  attended: number;
  absent: number;
  /** 出席＋缺席，也就是已經有結果的堂數 */
  checked: number;
  /** 0–100；還沒有任何一堂有結果時是 null */
  rate: number | null;
  /** 最長的連續缺課（中間的未點名不算中斷）；少於 `minStreak` 堂是 null */
  longestAbsence: { length: number; from: Slot; to: Slot } | null;
}

export function summarizeLesson(lesson: Pick<LessonAttendance, "studentAttendances">, minStreak = 3): LessonSummary {
  let attended = 0;
  let absent = 0;
  let best: LessonSummary["longestAbsence"] = null;
  let run: Slot[] = [];
  for (const slot of lesson.studentAttendances) {
    const status = periodStatus(slot);
    if (status === "attended") {
      attended++;
      run = [];
    } else if (status === "absent") {
      absent++;
      run.push(slot);
      if (run.length > (best?.length ?? 0)) best = { length: run.length, from: run[0], to: slot };
    }
  }
  const checked = attended + absent;
  return {
    attended,
    absent,
    checked,
    rate: checked === 0 ? null : Math.round((attended / checked) * 100),
    longestAbsence: best && best.length >= minStreak ? best : null,
  };
}

/** 進行中的在前，其餘依最後一堂的時間，新的在前。 */
export function sortLessons(lessons: LessonAttendance[]): LessonAttendance[] {
  const lastAt = (lesson: LessonAttendance) => {
    const slots = lesson.studentAttendances;
    return slots.length ? new Date(slots[slots.length - 1].periodStartTime).getTime() : 0;
  };
  return [...lessons].sort((a, b) => {
    const active = Number(b.status === "inProgress") - Number(a.status === "inProgress");
    return active !== 0 ? active : lastAt(b) - lastAt(a);
  });
}

export interface TimelineAxis {
  /** 第一週的週一 */
  start: Date;
  weeks: number;
  /** 本週在軸上的位置；本週不在軸上是 null */
  todayIndex: number | null;
  /** 每個月第一次出現的那一週 */
  months: { index: number; month: number }[];
}

const weekOf = (date: Date | string) => startOfWeek(new Date(date), { weekStartsOn: 1 });

/**
 * 從最早一堂（最多往回 TIMELINE_MAX_WEEKS 週）畫到本週或最後一堂，取較晚者——
 * 排好但還沒上的課也要看得到。
 */
export function buildTimelineAxis(lessons: LessonAttendance[], now = new Date()): TimelineAxis {
  const times = lessons.flatMap((lesson) => lesson.studentAttendances.map((slot) => weekOf(slot.periodStartTime)));
  const thisWeek = weekOf(now);
  const latest = times.reduce((max, week) => (week > max ? week : max), thisWeek);
  const earliest = times.reduce((min, week) => (week < min ? week : min), thisWeek);
  const span = differenceInCalendarWeeks(latest, earliest, { weekStartsOn: 1 }) + 1;
  const weeks = Math.min(span, TIMELINE_MAX_WEEKS);
  const start = addWeeks(latest, -(weeks - 1));

  const months: TimelineAxis["months"] = [];
  for (let index = 0; index < weeks; index++) {
    const month = addWeeks(start, index).getMonth();
    if (months[months.length - 1]?.month !== month) months.push({ index, month });
  }
  const todayIndex = differenceInCalendarWeeks(thisWeek, start, { weekStartsOn: 1 });
  return { start, weeks, todayIndex: todayIndex >= 0 && todayIndex < weeks ? todayIndex : null, months };
}

/** `gap` = 這門課開課期間、但那週沒排課；`none` = 不在這門課的期間。 */
export type WeekCell = PeriodStatus | "gap" | "none";

/** 同一週有缺就算缺，其次出席，最後未點名。 */
const CELL_PRIORITY: Record<PeriodStatus, number> = { absent: 3, attended: 2, unchecked: 1 };

export function lessonWeekCells(lesson: Pick<LessonAttendance, "studentAttendances">, axis: TimelineAxis): WeekCell[] {
  const cells: WeekCell[] = new Array(axis.weeks).fill("none");
  const slots = lesson.studentAttendances;
  if (slots.length === 0) return cells;

  const indexOf = (date: string) => differenceInCalendarWeeks(weekOf(date), axis.start, { weekStartsOn: 1 });
  const first = indexOf(slots[0].periodStartTime);
  const last = indexOf(slots[slots.length - 1].periodStartTime);
  for (let index = Math.max(first, 0); index <= Math.min(last, axis.weeks - 1); index++) cells[index] = "gap";

  for (const slot of slots) {
    const index = indexOf(slot.periodStartTime);
    if (index < 0 || index >= axis.weeks) continue;
    const status = periodStatus(slot);
    const current = cells[index];
    if (current === "gap" || current === "none" || CELL_PRIORITY[status] > CELL_PRIORITY[current]) {
      cells[index] = status;
    }
  }
  return cells;
}
