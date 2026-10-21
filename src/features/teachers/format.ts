import { format } from "date-fns";
import { toTaipeiMonthKey } from "@/lib/taipei-date";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function currentMonthKey(): string {
  return toTaipeiMonthKey(new Date());
}

/** "2026-10" → "2026 年 10 月" */
export function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return `${year} 年 ${mon} 月`;
}

/** "2026-05" → "5 月" */
export function shortMonthLabel(month: string): string {
  return `${Number(month.split("-")[1])} 月`;
}

/** "10/23（四）20:00" */
export function periodLabel(iso: string): string {
  const date = new Date(iso);
  return `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）${format(date, "HH:mm")}`;
}

/** "2025 年 3 月" */
export function sinceLabel(iso: string): string {
  return format(new Date(iso), "yyyy 年 M 月");
}
