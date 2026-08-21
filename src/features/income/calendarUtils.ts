// 月曆檢視共用的純函式(無副作用),供 IncomeCalendar 使用。

export const WEEKDAYS_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

export interface CalendarCell {
  date: string | null; // "YYYY-MM-DD",月初前的留白格為 null
  day: number | null;
}

// 依 "YYYY-MM" 產生整月格子,含月初前的留白(讓第一天對齊正確星期欄)。
export function buildMonthGrid(monthKey: string): CalendarCell[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${monthKey}-${String(d).padStart(2, "0")}`, day: d });
  }
  return cells;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// 依當月最大營收分三級,用於日曆格子深淺,0 = 當天無營收。
export function revenueTier(revenue: number, max: number): 0 | 1 | 2 | 3 {
  if (!revenue || revenue <= 0) return 0;
  if (max <= 0) return 1;
  if (revenue >= max * 0.66) return 3;
  if (revenue >= max * 0.33) return 2;
  return 1;
}

export function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return `${m}/${d} 週${WEEKDAYS_SHORT[weekday]}`;
}
