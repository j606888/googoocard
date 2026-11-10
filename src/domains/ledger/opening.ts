// 開帳：轉換日的期初分錄（docs/finance-v2/04-opening-and-cutover.md §3–4）。純函式。
// 算得出來的系統算（預收、應收、次數包），數得出來的人填（實數法的現金、還沒付的錢），
// 差額進各分部的「期初權益調整」。
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { balanceByBranch, type DesiredLine, type Party } from "./lines";
import { toCents } from "./money";
import { cardDeferredLocation, cardHolder, cardRemainingValue, cardUsageValues, usageValueKey } from "./post/card";
import type { CardInput, PostingContext } from "./post/types";

export type OpeningMethod = "CONVENTION" | "ACTUAL";

export type OpeningPayable = {
  kind: "TEACHER" | "VENUE" | "OWNER";
  partyId: number; // teacherId / venueId / userId
  locationId: number;
  amount: number; // 元
};

export type OpeningInput = {
  conversionDate: string;
  method: OpeningMethod;
  cards: CardInput[];
  ctx: PostingContext;
  /** 實數法：資金帳戶 → 實際金額（元）。約定法忽略。 */
  cash: { moneyAccountId: number; amount: number }[];
  /** 次數包在轉換日還沒用掉的價值（系統算）。 */
  prepaidVenues: { venueId: number; locationId: number; amount: number }[]; // 分
  payables: OpeningPayable[];
  /** 資金帳戶 → 分部（實數法用）。 */
  moneyAccountLocation: (moneyAccountId: number) => number | null;
};

export type OpeningCard = { cardId: number; locationId: number; deferred: number; receivable: number; holderUserId: number | null };

export type OpeningError = { code: string; detail: string; userId?: number; cardIds?: number[] };

export type OpeningResult = {
  lines: DesiredLine[];
  errors: OpeningError[];
  cards: OpeningCard[];
};

/** 轉換日那天開始時，一張卡還沒認列的價值（分）＝現在的剩餘價值＋轉換日（含）之後的使用。 */
export function deferredAtConversion(card: CardInput, conversionDate: string): number {
  const values = cardUsageValues(card);
  const after = card.usages
    .filter((u) => toTaipeiDateKey(u.startTime) >= conversionDate)
    .reduce((s, u) => s + (values.get(usageValueKey(u.kind, u.id)) ?? 0), 0);
  return cardRemainingValue(card) + after;
}

/**
 * 這張卡在帳本裡要用到收款人的資金帳戶嗎（收款人沒有 → NO_MONEY_ACCOUNT）：
 * - 轉換日（含）之後才付款：付款那天記進收款人的資金帳戶（postCard）；
 * - 轉換日前就付清、轉換日還開著、還有沒認列的價值：約定法的期初現金算在收款人手上（computeOpening）。
 * 收款人整理（service/finance/strayReceivers.ts）用同一條規則挑「要改記到保管人」的卡，兩邊才不會對不上。
 */
export function cardNeedsHolderAccount(card: CardInput, conversionDate: string): boolean {
  const C = conversionDate;
  if (!card.isPaid) return false;
  const payDate = toTaipeiDateKey(card.paidAt ?? card.createdAt);
  if (payDate >= C) return card.origin === "PURCHASE" && card.finalPrice !== 0;
  if (toTaipeiDateKey(card.createdAt) >= C) return false;
  if (card.expiredAt && toTaipeiDateKey(card.expiredAt) < C) return false;
  return deferredAtConversion(card, C) !== 0;
}

export function computeOpening(input: OpeningInput): OpeningResult {
  const C = input.conversionDate;
  const { ctx } = input;
  const cardLines: DesiredLine[] = [];
  const other: DesiredLine[] = [];
  const cards: OpeningCard[] = [];
  const missing = new Map<number, number[]>(); // holder without money account → cardIds
  const errors: { code: string; detail: string }[] = [];

  for (const card of input.cards) {
    if (toTaipeiDateKey(card.createdAt) >= C) continue; // 轉換日之後買的，正常過帳
    if (card.expiredAt && toTaipeiDateKey(card.expiredAt) < C) continue; // 轉換日前就關了
    const loc = cardDeferredLocation(card, ctx);
    if (loc === null) {
      errors.push({ code: "NO_LOCATION", detail: `card ${card.id}` });
      continue;
    }
    const party: Party = { type: "STUDENT_CARD", id: card.id };
    const deferred = deferredAtConversion(card, C);
    const price = toCents(card.finalPrice);
    const paidBefore = card.isPaid && toTaipeiDateKey(card.paidAt ?? card.createdAt) < C;
    const receivable = card.origin === "PURCHASE" && !paidBefore ? price : 0;
    if (deferred === 0 && receivable === 0) continue;
    const holder = paidBefore ? cardHolder(card, ctx) : null;
    cards.push({ cardId: card.id, locationId: loc, deferred, receivable, holderUserId: holder });

    if (deferred !== 0) cardLines.push({ date: C, account: { key: "DEFERRED_REVENUE" }, locationId: loc, amount: -deferred, party });
    if (receivable !== 0) other.push({ date: C, account: { key: "AR" }, locationId: loc, amount: receivable, party });

    // 約定法：舊卡的錢還在當初收錢的人那裡
    if (input.method === "CONVENTION" && paidBefore && cardNeedsHolderAccount(card, C)) {
      const ma = holder !== null ? ctx.moneyAccountOf(holder) : null;
      if (!ma) {
        const key = holder ?? -1;
        missing.set(key, [...(missing.get(key) ?? []), card.id]);
        continue;
      }
      cardLines.push({ date: C, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: deferred, party });
    }
    // 沒有對應現金的預收（實數法、或還沒付款的卡）：差額交給期初權益
  }

  // 約定法的「現金＝預收」逐張配對，跨分部的用分部往來；沒配對的預收留給期初權益。
  const paired = new Set(cardLines.filter((l) => "moneyAccountId" in l.account).map((l) => l.party!.id));
  const pairedLines = cardLines.filter((l) => l.party && paired.has(l.party.id));
  const unpaired = cardLines.filter((l) => !(l.party && paired.has(l.party.id)));
  const lines: DesiredLine[] = [...balanceByBranch(pairedLines), ...unpaired, ...other];

  if (input.method === "ACTUAL") {
    for (const c of input.cash) {
      const loc = input.moneyAccountLocation(c.moneyAccountId);
      if (loc === null) {
        errors.push({ code: "UNKNOWN_MONEY_ACCOUNT", detail: String(c.moneyAccountId) });
        continue;
      }
      const amt = toCents(c.amount);
      if (amt !== 0) lines.push({ date: C, account: { moneyAccountId: c.moneyAccountId }, locationId: loc, amount: amt });
    }
  }

  for (const p of input.prepaidVenues) {
    if (p.amount !== 0) lines.push({ date: C, account: { key: "PREPAID_VENUE" }, locationId: p.locationId, amount: p.amount, party: { type: "VENUE", id: p.venueId } });
  }

  for (const p of input.payables) {
    const amt = toCents(p.amount);
    if (amt === 0) continue;
    const key = p.kind === "TEACHER" ? "TEACHER_PAYABLE" : p.kind === "VENUE" ? "VENUE_PAYABLE" : "OWNER_PAYABLE";
    const partyType = p.kind === "TEACHER" ? "TEACHER" : p.kind === "VENUE" ? "VENUE" : "USER";
    lines.push({ date: C, account: { key }, locationId: p.locationId, amount: -amt, party: { type: partyType, id: p.partyId } });
  }

  // 每個分部的差額 → 期初權益調整
  const byLoc = new Map<number, number>();
  for (const l of lines) byLoc.set(l.locationId, (byLoc.get(l.locationId) ?? 0) + l.amount);
  for (const [loc, sum] of byLoc) {
    if (sum !== 0) lines.push({ date: C, account: { key: "OPENING_EQUITY" }, locationId: loc, amount: -sum });
  }

  const allErrors: OpeningError[] = [
    ...[...missing].map(([userId, cardIds]) => ({ code: "NO_MONEY_ACCOUNT", detail: `user ${userId}: ${cardIds.length} cards`, userId, cardIds })),
    ...errors,
  ];
  return { lines, errors: allErrors, cards };
}
