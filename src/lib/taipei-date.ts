const TAIPEI_OFFSET_MINUTES = 8 * 60;

export function toTaipeiDateKey(date: Date): string {
  const localMs = date.getTime() + TAIPEI_OFFSET_MINUTES * 60 * 1000;
  const localDate = new Date(localMs);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseTaipeiDateRange(dateKey: string): { start: Date; end: Date } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, -TAIPEI_OFFSET_MINUTES, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, -TAIPEI_OFFSET_MINUTES, 0, 0));
  return { start, end };
}

export function toTaipeiMonthKey(date: Date): string {
  return toTaipeiDateKey(date).slice(0, 7);
}

export function parseTaipeiMonthRange(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, -TAIPEI_OFFSET_MINUTES, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, -TAIPEI_OFFSET_MINUTES, 0, 0));
  return { start, end };
}

/** 日期字串加減天數：「2026-11-22」+ 7 →「2026-11-29」。 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 台北時間那一週的週日（週曆從週日排到週六）。 */
export function taipeiWeekStartKey(date: Date): string {
  const key = toTaipeiDateKey(date);
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
  return addDaysToDateKey(key, -weekday);
}
