// 支出（EXPENSE）與次數包（VENUE_PACK）。docs/finance-v2/02 §3.4、§3.5。
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { toCents } from "../money";
import type { DesiredLine } from "../lines";
import type { ExpenseInput, PostResult, PostingContext, VenuePackInput } from "./types";

export function postExpense(e: ExpenseInput, ctx: PostingContext): PostResult {
  const date = toTaipeiDateKey(e.date);
  if (e.voidedAt || date < ctx.conversionDate || e.amount === 0) return { lines: [], errors: [] };
  const ma = ctx.moneyAccountOf(e.paidByUserId);
  if (!ma) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  const amt = toCents(e.amount);
  const sub = ctx.expenseAccountOf(e.category);
  const lines: DesiredLine[] = [
    { date, account: sub !== null ? { accountId: sub } : { key: "EXPENSE_GENERAL" }, locationId: e.locationId, amount: amt },
    { date, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: -amt },
  ];
  return { lines, errors: [] };
}

export function postVenuePack(p: VenuePackInput, ctx: PostingContext): PostResult {
  const date = toTaipeiDateKey(p.purchasedAt);
  if (p.voidedAt || date < ctx.conversionDate || p.price === 0) return { lines: [], errors: [] };
  const ma = ctx.moneyAccountOf(p.paidByUserId);
  if (!ma) return { lines: [], errors: ["NO_MONEY_ACCOUNT"] };
  const amt = toCents(p.price);
  return {
    lines: [
      { date, account: { key: "PREPAID_VENUE" }, locationId: ma.locationId, amount: amt, party: { type: "VENUE", id: p.venueId } },
      { date, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: -amt },
    ],
    errors: [],
  };
}
