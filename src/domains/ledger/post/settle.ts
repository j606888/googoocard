// 付款、資金帳戶轉帳、業主交易、盤點（docs/finance-v2/02 §3.6、§3.7）。金額單位「分」。
import type { DesiredLine } from "../lines";
import type { CashCountInput, MoneyTransferInput, OwnerTxnInput, PayoutInput, PostResult, PostingContext } from "./types";

const none: PostResult = { lines: [], errors: [] };
const skip = (date: string | null, voided: boolean, ctx: PostingContext) => voided || date === null || date < ctx.conversionDate;

/** 付款：借 應付（應付的分部）／貸 現金（付款帳戶的分部）；取整的差額進尾差（付款人的分部）。 */
export function postPayout(p: PayoutInput, ctx: PostingContext): PostResult {
  if (skip(p.paidDate, p.voided, ctx) || p.amount === 0) return none;
  const date = p.paidDate!;
  const ma = p.fromMoneyAccountId !== null ? ctx.moneyAccount(p.fromMoneyAccountId) : null;
  if (!ma) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  const party = { type: p.partyType, id: p.partyId } as const;
  const lines: DesiredLine[] = [
    { date, account: { key: p.payableKey }, locationId: p.locationId, amount: p.amount, party },
    { date, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: -p.paidAmount },
  ];
  if (p.paidAmount !== p.amount) {
    lines.push({ date, account: { key: "ROUNDING" }, locationId: ma.locationId, amount: p.paidAmount - p.amount });
  }
  return { lines, errors: [] };
}

/** 轉帳：借 現金:到／貸 現金:從；跨分部由 balanceByBranch 補往來。 */
export function postMoneyTransfer(t: MoneyTransferInput, ctx: PostingContext): PostResult {
  if (skip(t.date, t.voided, ctx) || t.amount === 0) return none;
  const from = ctx.moneyAccount(t.fromMoneyAccountId);
  const to = ctx.moneyAccount(t.toMoneyAccountId);
  if (!from || !to) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  const date = t.date!;
  const lines: DesiredLine[] = [
    { date, account: { moneyAccountId: to.id }, locationId: to.locationId, amount: t.amount },
    { date, account: { moneyAccountId: from.id }, locationId: from.locationId, amount: -t.amount },
  ];
  if (t.settleAmount !== null && from.locationId !== to.locationId && t.settleAmount !== t.amount) {
    // 轉平往來但取整過：往來只清 settleAmount，零頭兩邊各記尾差（轉出的分部多付＝費用）。
    const r = t.amount - t.settleAmount;
    lines.push(
      { date, account: { key: "INTERBRANCH" }, locationId: from.locationId, amount: t.settleAmount, party: { type: "LOCATION", id: to.locationId } },
      { date, account: { key: "ROUNDING" }, locationId: from.locationId, amount: r },
      { date, account: { key: "INTERBRANCH" }, locationId: to.locationId, amount: -t.settleAmount, party: { type: "LOCATION", id: from.locationId } },
      { date, account: { key: "ROUNDING" }, locationId: to.locationId, amount: -r },
    );
  }
  return { lines, errors: [] };
}

export function postOwnerTxn(o: OwnerTxnInput, ctx: PostingContext): PostResult {
  if (skip(o.date, o.voided, ctx) || o.amount === 0) return none;
  const party = { type: "USER", id: o.userId } as const;
  if (o.kind === "DIVIDEND") {
    if (o.locationId === null || !ctx.locationExists(o.locationId)) return { lines: [], errors: ["NO_LOCATION"] };
    return {
      lines: [
        { date: o.date, account: { key: "RETAINED_EARNINGS" }, locationId: o.locationId, amount: o.amount, party },
        { date: o.date, account: { key: "OWNER_PAYABLE" }, locationId: o.locationId, amount: -o.amount, party },
      ],
      errors: [],
    };
  }
  const ma = o.moneyAccountId !== null ? ctx.moneyAccount(o.moneyAccountId) : null;
  if (!ma) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  const sign = o.kind === "CONTRIBUTION" ? 1 : -1;
  return {
    lines: [
      { date: o.date, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: sign * o.amount },
      {
        date: o.date,
        account: { key: o.kind === "CONTRIBUTION" ? "OWNER_CONTRIBUTION" : "OWNER_DRAWING" },
        locationId: ma.locationId,
        amount: -sign * o.amount,
        party,
      },
    ],
    errors: [],
  };
}

/** 盤點：實數 − 系統餘額 記進現金（短少為負），對方是現金短溢。 */
export function postCashCount(c: CashCountInput, ctx: PostingContext): PostResult {
  const diff = c.counted - c.systemBalance;
  if (skip(c.date, c.voided, ctx) || diff === 0) return none;
  const ma = ctx.moneyAccount(c.moneyAccountId);
  if (!ma) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  return {
    lines: [
      { date: c.date, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: diff },
      { date: c.date, account: { key: "CASH_OVER_SHORT" }, locationId: ma.locationId, amount: -diff },
    ],
    errors: [],
  };
}

/** 依取整單位（元）四捨五入，回傳分。 */
export function roundPayout(cents: number, roundToYuan: number): number {
  const unit = Math.max(1, roundToYuan) * 100;
  return Math.round(cents / unit) * unit;
}

/**
 * 分部往來轉平建議（像 Splitwise）：每個分部的往來餘額（正＝別的分部欠它）→ 最少筆數的轉帳。
 * 回傳 from（欠錢的分部）→ to（被欠的分部）。
 */
export function settleInterbranch(balances: Map<number, number>): { fromLocationId: number; toLocationId: number; amount: number }[] {
  const owed = [...balances].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const owing = [...balances].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: { fromLocationId: number; toLocationId: number; amount: number }[] = [];
  while (owed.length && owing.length) {
    owed.sort((a, b) => b.v - a.v || a.id - b.id);
    owing.sort((a, b) => b.v - a.v || a.id - b.id);
    const a = owing[0];
    const b = owed[0];
    const amt = Math.min(a.v, b.v);
    out.push({ fromLocationId: a.id, toLocationId: b.id, amount: amt });
    a.v -= amt;
    b.v -= amt;
    if (a.v === 0) owing.shift();
    if (b.v === 0) owed.shift();
  }
  return out;
}
