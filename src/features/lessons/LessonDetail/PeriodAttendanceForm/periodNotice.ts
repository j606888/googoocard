import { isSameDay } from "date-fns";

/**
 * 點名頁要不要提醒「這堂可能點錯」：不是今天的課 → `notToday`；今天但還沒開始 →
 * `notStarted`（以前是點「點名」時跳瀏覽器原生 confirm，改成頁面內提示）；其他 → null。
 */
export function periodNotice(startTime: Date, now: Date = new Date()): "notToday" | "notStarted" | null {
  if (!isSameDay(startTime, now)) return "notToday";
  if (startTime.getTime() > now.getTime()) return "notStarted";
  return null;
}
