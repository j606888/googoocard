// 支出（EXPENSE）與次數包（VENUE_PACK）。docs/finance-v2/02 §3.4、§3.5。
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { toCents } from "../money";
import type { DesiredLine } from "../lines";
import type { ExpenseInput, PostResult, PostingContext, VenuePackInput } from "./types";

export function postExpense(e: ExpenseInput, ctx: PostingContext): PostResult {
  const date = toTaipeiDateKey(e.date);
  if (e.voidedAt || date < ctx.conversionDate || e.amount === 0) return { lines: [], errors: [] };
  const amt = toCents(e.amount);
  const sub = ctx.expenseAccountOf(e.category);
  const expense: DesiredLine = { date, account: sub !== null ? { accountId: sub } : { key: "EXPENSE_GENERAL" }, locationId: e.locationId, amount: amt };
  if (e.isAdvance) {
    // 代墊：教室欠付款人（應付業主款），之後在付款批次還他。
    return {
      lines: [expense, { date, account: { key: "OWNER_PAYABLE" }, locationId: e.locationId, amount: -amt, party: { type: "USER", id: e.paidByUserId } }],
      errors: [],
    };
  }
  const ma = e.moneyAccountId !== null ? ctx.moneyAccount(e.moneyAccountId) : ctx.moneyAccountOf(e.paidByUserId);
  if (!ma) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  return { lines: [expense, { date, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: -amt }], errors: [] };
}

export function postVenuePack(p: VenuePackInput, ctx: PostingContext): PostResult {
  const date = toTaipeiDateKey(p.purchasedAt);
  if (p.voidedAt || date < ctx.conversionDate || p.price === 0) return { lines: [], errors: [] };
  const ma = ctx.moneyAccountIn(p.paidByUserId, p.locationId);
  if (!ma) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  const amt = toCents(p.price);
  return {
    lines: [
      { date, account: { key: "PREPAID_VENUE" }, locationId: p.locationId ?? ma.locationId, amount: amt, party: { type: "VENUE", id: p.venueId } },
      { date, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: -amt },
    ],
    errors: [],
  };
}
