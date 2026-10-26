import { toTaipeiDateKey } from "@/lib/taipei-date";

/**
 * Pure date math for the LIFF 課表 month calendar — everything in Taipei time,
 * whatever the phone's own timezone is.
 */

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

/** `"2026-10"` → 6×7-or-fewer weeks of date keys, Sunday first; null pads the edges. */
export function monthGrid(monthKey: string): (string | null)[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${monthKey}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** `"2026-10"`, ±n months. */
export function shiftMonth(monthKey: string, n: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** `"2026-10"` → 「2026 年 10 月」 */
export const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year} 年 ${month} 月`;
};

/** `"2026-10-28"` → 「10/28（三）」 */
export function dayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${month}/${day}（${WEEKDAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}）`;
}

/** 「20:00」 in Taipei. */
export function taipeiTime(iso: string | Date): string {
  const t = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

export const dateKeyOf = (iso: string | Date) => toTaipeiDateKey(new Date(iso));
