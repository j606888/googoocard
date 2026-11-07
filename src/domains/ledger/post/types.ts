// 過帳器的輸入（已從 DB 載好的純資料）。docs/finance-v2/02-accounting-model.md §3、03 §3。
import type { SplitRule } from "@/domains/finance/types";

export type MoneyAccountInfo = { id: number; locationId: number };

export type PostingContext = {
  /** 轉換日（台北 YYYY-MM-DD）：之前的事不過帳（由期初分錄涵蓋）。 */
  conversionDate: string;
  /** 保管人 → 預設資金帳戶。 */
  moneyAccountOf: (userId: number) => MoneyAccountInfo | null;
  /** 上線前沒記收款人的錢算誰的（feat/finance 的 legacyCustodianUserId）。 */
  legacyHolderUserId: number | null;
  /** 找不到分部時的預設分部（排序第一的分部）。 */
  defaultLocationId: number | null;
  /** 分部存在且沒封存？ */
  locationExists: (locationId: number) => boolean;
  /** 分部的過期收入要再分給某人（expiryTo = USER）→ userId；否則 null。 */
  expiryUserOf: (locationId: number) => number | null;
  /** 營業費用子科目（依類別名稱）的 accountId；找不到回 null（用 EXPENSE_GENERAL）。 */
  expenseAccountOf: (category: string) => number | null;
  /** 次數包付款人的資金帳戶。 */
  packMoneyAccountOf: (packId: number) => MoneyAccountInfo | null;
  /** 依 id 找資金帳戶（含封存的；不存在回 null）。 */
  moneyAccount: (id: number) => MoneyAccountInfo | null;
};

/** 一張卡的一次使用（出席或綁課卡缺席扣格）。 */
export type CardUsage = {
  kind: "attendance" | "absence";
  id: number;
  periodId: number;
  startTime: Date;
  sessionsUsed: number;
  /** 時段已點名（attendanceTakenAt 非 null）。只有已點名的時段會認列收入。 */
  checked: boolean;
};

export type CardInput = {
  id: number;
  createdAt: Date;
  finalPrice: number; // 元
  totalSessions: number;
  remainingSessions: number;
  isPaid: boolean;
  paidAt: Date | null;
  paidByUserId: number | null;
  origin: "PURCHASE" | "CONVERSION" | "TRANSFER";
  soldLocationId: number | null;
  expiredAt: Date | null;
  closedReason: string | null;
  convertedToId: number | null;
  transferredToId: number | null;
  refund: { amount: number; paidByUserId: number; date: Date } | null;
  usages: CardUsage[];
};

export type PeriodUsage = {
  kind: "attendance" | "absence";
  id: number;
  cardId: number;
  /** 這次使用的價值（分），由 cardUsageValues 算好。 */
  value: number;
  /** 卡的預收所在分部（cardDeferredLocation）。 */
  cardLocationId: number;
  paid: boolean;
};

export type PeriodDropIn = {
  id: number;
  amount: number; // 元
  isPaid: boolean;
  paidAt: Date | null;
  createdAt: Date;
  paidByUserId: number | null;
};

export type PeriodInput = {
  id: number;
  startTime: Date;
  /** 這堂課的基金分部（規則的 fundLocationId；沒規則 → 上課分部）。 */
  fundLocationId: number | null;
  rule: SplitRule | null;
  /** 這堂用掉的次數包（規則有 venuePack 行時）；null＝沒有包可扣。 */
  pack: { venueId: number; packId: number; unit: number } | null;
  usages: PeriodUsage[];
  dropIns: PeriodDropIn[];
};

export type ExpenseInput = {
  id: number;
  date: Date;
  amount: number;
  locationId: number;
  category: string;
  paidByUserId: number;
  /** 指定從哪個資金帳戶付；null＝付款人的預設帳戶。 */
  moneyAccountId: number | null;
  /** 付款人用自己的錢代墊 → 貸 應付業主款（不動資金帳戶）。 */
  isAdvance: boolean;
  voidedAt: Date | null;
};

// ── P5：以下金額單位都是「分」，日期是台北 YYYY-MM-DD。

export type PayableKey = "TEACHER_PAYABLE" | "VENUE_PAYABLE" | "OWNER_PAYABLE";

export type PayoutInput = {
  id: number;
  partyType: "TEACHER" | "VENUE" | "USER";
  partyId: number;
  payableKey: PayableKey;
  locationId: number;
  amount: number;
  paidAmount: number;
  fromMoneyAccountId: number | null;
  /** 已付款才過帳 */
  paidDate: string | null;
  voided: boolean;
};

export type MoneyTransferInput = {
  id: number;
  fromMoneyAccountId: number;
  toMoneyAccountId: number;
  amount: number;
  /** 分部往來轉平：清掉的往來金額（取整前）；null＝一般轉帳。 */
  settleAmount: number | null;
  date: string | null; // 完成日；null＝還沒轉
  voided: boolean;
};

export type OwnerTxnInput = {
  id: number;
  kind: "CONTRIBUTION" | "DRAWING" | "DIVIDEND";
  userId: number;
  amount: number;
  date: string;
  moneyAccountId: number | null;
  locationId: number | null;
  voided: boolean;
};

export type CashCountInput = {
  id: number;
  moneyAccountId: number;
  date: string;
  systemBalance: number;
  counted: number;
  voided: boolean;
};

export type VenuePackInput = {
  id: number;
  venueId: number;
  purchasedAt: Date;
  price: number;
  paidByUserId: number;
  voidedAt: Date | null;
};

/** 過帳結果：有 errors 時這個來源不過帳（保留上次的分錄），由健康檢查列出。 */
export type PostResult = { lines: import("../lines").DesiredLine[]; errors: string[] };
