import { describe, it, expect } from "vitest";
import { pendingPayoutFor } from "./financeUi";
import type { FinanceTransfer } from "@/store/slices/finance";
import type { Payout } from "@/service/finance/settlement";

const payouts: Payout[] = [
  { fromUserId: 4, toKind: "USER", toUserId: 1, amount: 1667 },
  { fromUserId: 4, toKind: "TEACHER", toTeacherId: 9, amount: 568 },
];

const transfer = (over: Partial<FinanceTransfer>): FinanceTransfer => ({
  id: 1,
  date: "2026-12-03T00:00:00.000Z",
  amount: 0,
  fromUserId: 4,
  toKind: "USER",
  toUserId: 1,
  toTeacherId: null,
  toVenueId: null,
  settlementMonth: "2026-11",
  note: null,
  createdById: 4,
  createdAt: "2026-12-03T00:00:00.000Z",
  ...over,
});

describe("pendingPayoutFor", () => {
  it("同一對人、還沒按已完成 → 回傳那筆和還沒轉的金額（不比金額）", () => {
    expect(pendingPayoutFor(payouts, [], "2026-11", 4, { toKind: "USER", toUserId: 1 })).toEqual({
      payout: payouts[0],
      remaining: 1667,
    });
  });

  it("按過一部分 → 剩下的金額；全部按完 → null", () => {
    const part = [transfer({ amount: 1000 })];
    expect(pendingPayoutFor(payouts, part, "2026-11", 4, { toKind: "USER", toUserId: 1 })?.remaining).toBe(667);
    const done = [transfer({ amount: 1667 })];
    expect(pendingPayoutFor(payouts, done, "2026-11", 4, { toKind: "USER", toUserId: 1 })).toBeNull();
  });

  it("平常的轉帳（沒掛結算月）不算已完成", () => {
    const plain = [transfer({ amount: 1667, settlementMonth: null })];
    expect(pendingPayoutFor(payouts, plain, "2026-11", 4, { toKind: "USER", toUserId: 1 })?.remaining).toBe(1667);
  });

  it("不同對象或不同轉出人 → null", () => {
    expect(pendingPayoutFor(payouts, [], "2026-11", 4, { toKind: "TEACHER", toTeacherId: 8 })).toBeNull();
    expect(pendingPayoutFor(payouts, [], "2026-11", 1, { toKind: "USER", toUserId: 1 })).toBeNull();
    expect(pendingPayoutFor(payouts, [], "2026-11", 4, { toKind: "SELF" })).toBeNull();
  });
});
