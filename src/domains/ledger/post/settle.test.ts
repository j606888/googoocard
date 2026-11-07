import { describe, it, expect } from "vitest";
import { balanceByBranch, unbalanced } from "../lines";
import { postCashCount, postMoneyTransfer, postOwnerTxn, postPayout, roundPayout, settleInterbranch } from "./settle";
import type { PostingContext } from "./types";

const T = 1, K = 2;
const ctx = {
  conversionDate: "2026-11-01",
  moneyAccount: (id: number) => (id === 100 ? { id, locationId: T } : id === 200 ? { id, locationId: K } : null),
  locationExists: (id: number) => id === T || id === K,
} as unknown as PostingContext;
const sumBy = (lines: { locationId: number; amount: number }[], loc: number) => lines.filter((l) => l.locationId === loc).reduce((s, l) => s + l.amount, 0);

describe("settle posting", () => {
  it("rounds payouts to the classroom unit", () => {
    expect(roundPayout(68334, 1)).toBe(68300);
    expect(roundPayout(66666, 1)).toBe(66700);
    expect(roundPayout(27525, 10)).toBe(28000);
  });

  it("payout clears the payable at its branch, cash at the payer's branch, rounding with the payer", () => {
    const r = postPayout(
      { id: 1, partyType: "TEACHER", partyId: 9, payableKey: "TEACHER_PAYABLE", locationId: T, amount: 36666, paidAmount: 36700, fromMoneyAccountId: 200, paidDate: "2026-12-03", voided: false },
      ctx,
    );
    const lines = balanceByBranch(r.lines);
    expect(unbalanced(lines)).toEqual([]);
    expect(lines.find((l) => "key" in l.account && l.account.key === "ROUNDING")).toMatchObject({ locationId: K, amount: 34 });
    expect(lines.filter((l) => "key" in l.account && l.account.key === "INTERBRANCH").map((l) => [l.locationId, l.amount])).toEqual(
      expect.arrayContaining([[T, -36666], [K, 36666]]),
    );
    expect(postPayout({ id: 1, partyType: "TEACHER", partyId: 9, payableKey: "TEACHER_PAYABLE", locationId: T, amount: 1, paidAmount: 1, fromMoneyAccountId: 200, paidDate: null, voided: false }, ctx).lines).toEqual([]);
  });

  it("a rounded interbranch settlement clears exactly the owed amount", () => {
    const r = postMoneyTransfer({ id: 1, fromMoneyAccountId: 100, toMoneyAccountId: 200, amount: 70000, settleAmount: 69999, date: "2026-12-03", voided: false }, ctx);
    const lines = balanceByBranch(r.lines);
    expect(sumBy(lines, T)).toBe(0);
    expect(sumBy(lines, K)).toBe(0);
    const ib = lines.filter((l) => "key" in l.account && l.account.key === "INTERBRANCH");
    expect(ib.map((l) => [l.locationId, l.amount])).toEqual([[T, 69999], [K, -69999]]);
  });

  it("owner transactions and cash counts", () => {
    expect(postOwnerTxn({ id: 1, kind: "DIVIDEND", userId: 5, amount: 100, date: "2026-12-01", moneyAccountId: null, locationId: 99, voided: false }, ctx).errors).toEqual(["NO_LOCATION"]);
    const d = postOwnerTxn({ id: 1, kind: "DRAWING", userId: 5, amount: 100, date: "2026-12-01", moneyAccountId: 200, locationId: null, voided: false }, ctx);
    expect(d.lines.map((l) => l.amount)).toEqual([-100, 100]);
    const c = postCashCount({ id: 1, moneyAccountId: 100, date: "2026-12-01", systemBalance: 505000, counted: 500000, voided: false }, ctx);
    expect(c.lines.map((l) => l.amount)).toEqual([-5000, 5000]);
  });

  it("interbranch settlement needs the fewest transfers", () => {
    expect(settleInterbranch(new Map([[T, -70000], [K, 70000]]))).toEqual([{ fromLocationId: T, toLocationId: K, amount: 70000 }]);
    const s = settleInterbranch(new Map([[1, -500], [2, 300], [3, 200]]));
    expect(s).toEqual([{ fromLocationId: 1, toLocationId: 2, amount: 300 }, { fromLocationId: 1, toLocationId: 3, amount: 200 }]);
    expect(settleInterbranch(new Map([[1, 0]]))).toEqual([]);
  });
});
