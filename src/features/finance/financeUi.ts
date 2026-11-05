import { toTaipeiDateKey } from "@/lib/taipei-date";
import type { FinanceTransfer } from "@/store/slices/finance";
import type { Payout } from "@/service/finance/settlement";

/** 台北今天 YYYY-MM-DD。 */
export const todayKey = () => toTaipeiDateKey(new Date());

const ERROR_TEXT: Record<string, string> = {
  MONTH_NOT_ENDED: "這個月還沒結束，月底過後才能確認結算",
  MONTH_NOT_OPEN: "只能依序結算最早還沒結算的月份，或這個月已經結算過了",
  UNALLOCATED: "還有錢不知道要給誰（有課沒有分帳規則），先到那堂課補上規則",
  MONTH_LOCKED: "這筆屬於已結算的月份，不能再作廢",
  NOT_PAYER: "只有這筆的付款人或可以結算的人能按已完成",
  REFUND_EXCEEDS_VALUE: "退費金額超過這張卡剩下的價值",
  CARD_NOT_PAID: "這張卡還沒付款，不能退費",
  CARD_CLOSED: "這張卡已經停用或退過費",
  NOT_FINANCE_MEMBER: "要選保管人，先在財務成員勾成保管人",
};

/** RTK Query 的錯誤 → 白話。 */
export function financeErrorText(e: unknown, fallback = "操作失敗，請再試一次"): string {
  const code = (e as { data?: { code?: string } })?.data?.code;
  return (code && ERROR_TEXT[code]) || fallback;
}

/** 這筆待轉的錢對應到哪個轉帳（同一個人 → 同一個對象，記在這個月的結算底下）。 */
export function matchingTransfers(payout: Payout, transfers: FinanceTransfer[], month: string): FinanceTransfer[] {
  return transfers.filter(
    (t) =>
      t.settlementMonth === month &&
      t.fromUserId === payout.fromUserId &&
      t.toKind === payout.toKind &&
      (t.toUserId ?? null) === (payout.toUserId ?? null) &&
      (t.toTeacherId ?? null) === (payout.toTeacherId ?? null) &&
      (t.toVenueId ?? null) === (payout.toVenueId ?? null),
  );
}

export function isPayoutDone(payout: Payout, transfers: FinanceTransfer[], month: string): boolean {
  const sum = matchingTransfers(payout, transfers, month).reduce((s, t) => s + t.amount, 0);
  return sum >= payout.amount;
}

export const monthLabel = (month: string) => `${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`;

/** 往前／往後推 n 個月。 */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
