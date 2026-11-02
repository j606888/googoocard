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

/**
 * 台北某天 00:00 往後加 N 個月（日超過該月天數就取月底），回傳該時刻的 Date。
 * 例：("2026-11-03", 6) → 2027-05-03 00:00 台北 = 2027-05-02T16:00:00Z。
 */
export function addMonthsTaipei(dateYmd: string, months: number): Date {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDay), 0, -TAIPEI_OFFSET_MINUTES, 0, 0));
}
