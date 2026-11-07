import { toTaipeiMonthKey } from "@/lib/taipei-date";

// 月份工具（台北時間）。財務 v2 用鎖帳日取代月結快照，這裡只剩月份換算。

/** 台北月份 YYYY-MM。 */
export function monthOf(date: Date): string {
  return toTaipeiMonthKey(date);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
