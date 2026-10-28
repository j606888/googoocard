import { toTaipeiDateKey } from "@/lib/taipei-date";

/** $12,300；signed 時正數帶 +。 */
export function money(n: number, { signed = false } = {}): string {
  const abs = `$${Math.abs(n).toLocaleString("en-US")}`;
  if (n < 0) return `−${abs}`;
  return signed && n > 0 ? `+${abs}` : abs;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 10/30（四） */
export function dayLabel(iso: string | Date): string {
  const key = toTaipeiDateKey(new Date(iso));
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}（${WEEKDAYS[weekday]}）`;
}

export const todayKey = () => toTaipeiDateKey(new Date());
export const dateKeyOf = (iso: string) => toTaipeiDateKey(new Date(iso));

/** API 錯誤的中文訊息（service 丟出來的 message），沒有就用 fallback。 */
export function errorText(error: unknown, fallback = "沒有成功，請再試一次"): string {
  const data = (error as { data?: { error?: string; code?: string } })?.data;
  if (data?.error && data.error !== data.code && /[一-鿿]/.test(data.error)) return data.error;
  return fallback;
}

/** 金額輸入框的字 → 整數；空的或不是數字回 null。 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(/[,\s$]/g, "");
  if (cleaned === "" || !/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}
