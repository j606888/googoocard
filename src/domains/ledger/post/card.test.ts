import { describe, expect, it } from "vitest";
import { postCard, cardRemainingValue, cardUsageValues } from "./card";
import { balanceByBranch, unbalanced, type DesiredLine } from "../lines";
import type { CardInput, PostingContext } from "./types";

const T = 1;
const K = 2;
const DING = 10;
const SEAN = 20;
const tpe = (ymd: string) => new Date(`${ymd}T04:00:00Z`); // 台北中午

const ctx = (over: Partial<PostingContext> = {}): PostingContext => ({
  conversionDate: "2026-11-01",
  moneyAccountOf: (u) => (u === DING ? { id: 100, locationId: T } : u === SEAN ? { id: 200, locationId: K } : null),
  moneyAccount: (id) => (id === 100 ? { id, locationId: T } : id === 200 ? { id, locationId: K } : null),
  legacyHolderUserId: SEAN,
  defaultLocationId: T,
  locationExists: (id) => id === T || id === K,
  expiryUserOf: () => null,
  expenseAccountOf: () => null,
  packMoneyAccountOf: () => null,
  ...over,
});

const card = (over: Partial<CardInput> = {}): CardInput => ({
  id: 1,
  createdAt: tpe("2026-11-04"),
  finalPrice: 2000,
  totalSessions: 6,
  remainingSessions: 6,
  isPaid: true,
  paidAt: tpe("2026-11-04"),
  paidByUserId: DING,
  origin: "PURCHASE",
  soldLocationId: T,
  expiredAt: null,
  closedReason: null,
  convertedToId: null,
  transferredToId: null,
  refund: null,
  usages: [],
  ...over,
});

const sum = (lines: DesiredLine[], pred: (l: DesiredLine) => boolean) =>
  lines.filter(pred).reduce((s, l) => s + l.amount, 0);
const isKey = (k: string) => (l: DesiredLine) => "key" in l.account && l.account.key === k;
const isMoney = (id: number) => (l: DesiredLine) => "moneyAccountId" in l.account && l.account.moneyAccountId === id;

describe("postCard", () => {
  it("paid purchase: AR in and out, cash up, deferred up", () => {
    const { lines, errors } = postCard(card(), ctx());
    expect(errors).toEqual([]);
    expect(sum(lines, isKey("AR"))).toBe(0);
    expect(sum(lines, isKey("DEFERRED_REVENUE"))).toBe(-200000);
    expect(sum(lines, isMoney(100))).toBe(200000);
    expect(unbalanced(balanceByBranch(lines))).toEqual([]);
  });

  it("unpaid purchase stays in AR", () => {
    const { lines } = postCard(card({ isPaid: false, paidAt: null, paidByUserId: null }), ctx());
    expect(sum(lines, isKey("AR"))).toBe(200000);
    expect(lines.some(isMoney(100))).toBe(false);
  });

  it("a card bought before the conversion date posts nothing for the sale; a later payment clears opening AR", () => {
    expect(postCard(card({ createdAt: tpe("2026-10-20"), paidAt: tpe("2026-10-20") }), ctx()).lines).toEqual([]);
    const { lines } = postCard(card({ createdAt: tpe("2026-10-20"), paidAt: tpe("2026-11-03") }), ctx());
    expect(sum(lines, isKey("AR"))).toBe(-200000);
    expect(sum(lines, isMoney(100))).toBe(200000);
  });

  it("legacy card without receiver is held by the legacy custodian (cross-branch payment → interbranch)", () => {
    const { lines } = postCard(card({ paidByUserId: null, paidAt: tpe("2026-11-04") }), ctx());
    expect(sum(lines, isMoney(200))).toBe(200000);
    const out = balanceByBranch(lines);
    expect(unbalanced(out)).toEqual([]);
    expect(sum(out, isKey("INTERBRANCH"))).toBe(0);
  });

  it("missing money account is an error, not a silent skip", () => {
    expect(postCard(card({ paidByUserId: 999 }), ctx()).errors).toEqual(["NO_MONEY_ACCOUNT"]);
  });

  it("expiry of a paid card turns the remaining slices into breakage; with expiryTo USER also declares a payout", () => {
    const c = card({ remainingSessions: 2, expiredAt: tpe("2027-05-04"), closedReason: "EXPIRED" });
    expect(cardRemainingValue(c)).toBe(66668);
    const { lines } = postCard(c, ctx({ expiryUserOf: () => SEAN }));
    expect(sum(lines, isKey("REVENUE_BREAKAGE"))).toBe(-66668);
    expect(sum(lines, (l) => isKey("OWNER_PAYABLE")(l) && l.party?.id === SEAN)).toBe(-66668);
    expect(sum(lines, isKey("RETAINED_EARNINGS"))).toBe(66668);
    expect(unbalanced(balanceByBranch(lines))).toEqual([]);
  });

  it("expiry of an unpaid card cancels that part of AR", () => {
    const c = card({ isPaid: false, paidAt: null, paidByUserId: null, remainingSessions: 5, expiredAt: tpe("2027-05-04"), closedReason: "EXPIRED" });
    const { lines } = postCard(c, ctx());
    expect(sum(lines, isKey("AR"))).toBe(200000 - 166667);
    expect(lines.some(isKey("REVENUE_BREAKAGE"))).toBe(false);
  });

  it("refund: deferred out, cash out, the difference is breakage", () => {
    const c = card({
      remainingSessions: 4,
      expiredAt: tpe("2026-11-20"),
      closedReason: "REFUNDED",
      refund: { amount: 1000, paidByUserId: DING, date: tpe("2026-11-20") },
    });
    const { lines } = postCard(c, ctx());
    expect(sum(lines, isMoney(100))).toBe(200000 - 100000);
    expect(sum(lines, isKey("REVENUE_BREAKAGE"))).toBe(-(133334 - 100000));
    expect(sum(lines, isKey("DEFERRED_REVENUE"))).toBe(-200000 + 133334);
  });

  it("conversion: the new card carries the old cards' deferred revenue, the price difference adjusts breakage", () => {
    const newCard = card({ id: 2, origin: "CONVERSION", finalPrice: 700, createdAt: tpe("2026-11-20"), paidAt: tpe("2026-11-20") });
    const { lines } = postCard(newCard, ctx(), [{ cardId: 1, value: 66668, locationId: T, closedAt: tpe("2026-11-20") }]);
    expect(sum(lines, (l) => isKey("DEFERRED_REVENUE")(l) && l.party?.id === 1)).toBe(66668);
    expect(sum(lines, (l) => isKey("DEFERRED_REVENUE")(l) && l.party?.id === 2)).toBe(-70000);
    expect(sum(lines, isKey("REVENUE_BREAKAGE"))).toBe(70000 - 66668);
    expect(lines.some(isMoney(100))).toBe(false); // 沒有新的金流
  });

  it("a card closed by conversion posts no expiry of its own", () => {
    const old = card({ remainingSessions: 2, expiredAt: tpe("2026-11-20"), convertedToId: 2 });
    expect(postCard(old, ctx()).lines.some(isKey("REVENUE_BREAKAGE"))).toBe(false);
  });
});

describe("cardUsageValues", () => {
  it("slices follow usage order and the last slice absorbs the remainder", () => {
    const u = (id: number, ymd: string, kind: "attendance" | "absence" = "attendance", sessionsUsed = 1) => ({
      kind, id, periodId: id, startTime: tpe(ymd), sessionsUsed, checked: true,
    });
    const values = cardUsageValues(card({ usages: [u(3, "2026-11-20", "attendance", 2), u(1, "2026-11-05"), u(2, "2026-11-12", "absence"), u(4, "2026-11-27", "attendance", 2)] }));
    expect([...values.values()].reduce((a, b) => a + b, 0)).toBe(200000);
    expect(values.get("attendance:4")).toBe(66668);
  });
});
