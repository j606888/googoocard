import { differenceInCalendarDays, differenceInCalendarWeeks, format, startOfWeek } from "date-fns";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { StudentAttendance, StudentWithDetail } from "@/store/slices/students";

/** 出席方格看這麼多週（含本週）。 */
export const INSIGHT_WEEKS = 13;

type ByDate = StudentWithDetail["attendancesByDate"];

/** 把依日期分組的出席攤平成一列（新的在前，和 API 的順序一樣）。 */
export function flattenAttendances(byDate: ByDate): StudentAttendance[] {
  return byDate.flatMap((day) => day.attendances);
}

/** 自助簽到／老師點名／待老師確認。 */
export function attendanceSourceLabel(attendance: Pick<StudentAttendance, "source" | "pending">): {
  label: string;
  tone: "self" | "teacher" | "pending";
} {
  if (attendance.pending) return { label: "待老師確認", tone: "pending" };
  if (attendance.source === "STUDENT") return { label: "自助簽到", tone: "self" };
  return { label: "老師點名", tone: "teacher" };
}

export interface MonthGroup {
  /** "2026-10" */
  key: string;
  label: string;
  attendances: StudentAttendance[];
}

/** 依上課月份分組（瀏覽器時區），新的月份在前；輸入已是新的在前。 */
export function groupByMonth(attendances: StudentAttendance[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const attendance of attendances) {
    const at = new Date(attendance.startTime);
    const key = format(at, "yyyy-MM");
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.attendances.push(attendance);
    else groups.push({ key, label: format(at, "yyyy 年 M 月"), attendances: [attendance] });
  }
  return groups;
}

/** 整月整月地取，直到至少有 `minRows` 筆為止（給「載入更早的紀錄」用）。 */
export function takeMonthsUntil(groups: MonthGroup[], minRows: number): MonthGroup[] {
  const taken: MonthGroup[] = [];
  let rows = 0;
  for (const group of groups) {
    if (rows >= minRows) break;
    taken.push(group);
    rows += group.attendances.length;
  }
  return taken;
}

/**
 * 近 N 週每週出席幾堂，從最早的那週到本週（週一起算）。
 * 給方格用：長度固定 N，沒出席的週是 0。
 */
export function weeklyCounts(
  attendances: Pick<StudentAttendance, "startTime">[],
  now = new Date(),
  weeks = INSIGHT_WEEKS
): number[] {
  const counts = new Array<number>(weeks).fill(0);
  const thisWeek = startOfWeek(now, { weekStartsOn: 1 });
  for (const attendance of attendances) {
    const weeksAgo = differenceInCalendarWeeks(thisWeek, new Date(attendance.startTime), { weekStartsOn: 1 });
    if (weeksAgo < 0 || weeksAgo >= weeks) continue;
    counts[weeks - 1 - weeksAgo] += 1;
  }
  return counts;
}

/** 方格的深淺：0 / 1 / 2 / 3+ 堂。 */
export function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

/** 一句話的摘要：「平均每週 1.6 堂」；沒上過課回 null。 */
export function weeklyAverageLabel(counts: number[]): string | null {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;
  const average = total / counts.length;
  return `平均每週 ${average >= 10 ? Math.round(average) : average.toFixed(1)} 堂`;
}

/** 近 N 週裡兩次上課之間最久隔了幾天（含到今天的空檔）；少於兩個點回 null。 */
export function longestGapDays(
  attendances: Pick<StudentAttendance, "startTime">[],
  now = new Date(),
  weeks = INSIGHT_WEEKS
): number | null {
  const cutoff = startOfWeek(now, { weekStartsOn: 1 });
  cutoff.setDate(cutoff.getDate() - 7 * (weeks - 1));
  const times = attendances
    .map((attendance) => new Date(attendance.startTime))
    .filter((at) => at >= cutoff && at <= now)
    .sort((a, b) => a.getTime() - b.getTime());
  if (times.length === 0) return null;
  let longest = 0;
  for (let i = 1; i < times.length; i++) {
    longest = Math.max(longest, differenceInCalendarDays(times[i], times[i - 1]));
  }
  longest = Math.max(longest, differenceInCalendarDays(now, times[times.length - 1]));
  return longest;
}

export interface StyleCount {
  style: DanceStyleSummary | null;
  count: number;
}

/** 依舞種計數，多的在前；沒有舞種的課歸到 style = null。 */
export function countByStyle(attendances: Pick<StudentAttendance, "danceStyle">[]): StyleCount[] {
  const byId = new Map<number | null, StyleCount>();
  for (const attendance of attendances) {
    const id = attendance.danceStyle?.id ?? null;
    const entry = byId.get(id) ?? { style: attendance.danceStyle ?? null, count: 0 };
    entry.count += 1;
    byId.set(id, entry);
  }
  return [...byId.values()].sort((a, b) => b.count - a.count);
}
