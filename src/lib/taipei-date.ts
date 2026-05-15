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
