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
  // 財務 v2
  PERIOD_LOCKED: "這一天已經鎖帳，改記在鎖帳日之後",
  BEFORE_CONVERSION: "這一天在開帳日之前，帳本不記",
  NOT_FINANCE: "只有可以結算的人（或這個帳戶的保管人）能做這件事",
  OWNER_ONLY: "只有教室擁有者能解鎖或把鎖帳日往前",
  LOCK_IN_FUTURE: "不能鎖還沒到的日子",
  LEDGER_NOT_OPENED: "要先開帳才能鎖帳",
  LEDGER_LOCKED: "已經鎖過帳，不能再重開",
  OPENING_INCOMPLETE: "還有收過錢的人沒有資金帳戶，先替他建帳戶",
  UNBALANCED: "借貸不平衡",
  INVALID_ACCOUNT: "這個科目不能用（現金要記在某個資金帳戶，分部往來會自動補）",
  INVALID_LOCATION: "資金帳戶的分錄要記在它所屬的分部",
  ALREADY_REVERSED: "這筆已經沖銷過了",
  NOT_REVERSIBLE: "系統自動記的分錄不能沖銷，請改原本那筆紀錄",
  PAYOUT_NOT_PENDING: "這筆已經處理過了",
  TRANSFER_NOT_PENDING: "這筆已經處理過了",
  INVALID_MONEY_ACCOUNT: "請選一個資金帳戶",
  NOT_KEEPER: "只有這個分部的負責人或擁有者能簽核",
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

type TransferTarget = Pick<Payout, "toKind" | "toUserId" | "toTeacherId" | "toVenueId">;

/**
 * 記轉帳時的提醒：已結算月份的結算單上，同一對人（誰轉出 → 轉給誰）還沒按「已完成」的那筆。
 * 不比金額（可能只轉了一部分）。回傳還沒轉的金額，沒有就 null。
 */
export function pendingPayoutFor(
  payouts: Payout[],
  transfers: FinanceTransfer[],
  month: string,
  fromUserId: number,
  target: TransferTarget,
): { payout: Payout; remaining: number } | null {
  const payout = payouts.find(
    (p) =>
      p.fromUserId === fromUserId &&
      p.toKind === target.toKind &&
      (p.toUserId ?? null) === (target.toUserId ?? null) &&
      (p.toTeacherId ?? null) === (target.toTeacherId ?? null) &&
      (p.toVenueId ?? null) === (target.toVenueId ?? null),
  );
  if (!payout) return null;
  const paid = matchingTransfers(payout, transfers, month).reduce((s, t) => s + t.amount, 0);
  const remaining = payout.amount - paid;
  return remaining > 0 ? { payout, remaining } : null;
}

/** 轉帳的對象名稱（「自己領走」／成員／老師／場地）。 */
export function transferTargetName(
  t: Pick<FinanceTransfer, "toKind" | "toUserId" | "toTeacherId" | "toVenueId">,
  n: { user: (id: number) => string; teacher: (id: number) => string; venue: (id: number) => string },
): string {
  if (t.toKind === "SELF") return "自己領走";
  if (t.toKind === "USER") return n.user(t.toUserId ?? 0);
  if (t.toKind === "TEACHER") return n.teacher(t.toTeacherId ?? 0);
  return n.venue(t.toVenueId ?? 0);
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
