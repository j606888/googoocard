import { describe, expect, it } from "vitest";
import { cardUnitValue, periodIncome, type IncomeSource } from "./income";

const card = (refId: number, studentId: number, amount: number, paid = true): IncomeSource => ({
  kind: "card", refId, studentId, amount, paid, holderUserId: 1,
});

describe("cardUnitValue", () => {
  it("is finalPrice / totalSessions", () => {
    expect(cardUnitValue({ finalPrice: 2000, totalSessions: 6 })).toBeCloseTo(333.33, 2);
  });
});

describe("periodIncome", () => {
  it("case 1 before 小美 decides", () => {
    const r = periodIncome(
      [card(1, 1, cardUnitValue({ finalPrice: 2000, totalSessions: 6 })), card(2, 2, cardUnitValue({ finalPrice: 2000, totalSessions: 6 }))],
      [3],
    );
    expect(r.total).toBeCloseTo(666.67, 2);
    expect(r.realized).toHaveLength(2);
    expect(r.pending).toEqual([{ studentId: 3, kind: "undecided", amount: null }]);
  });

  it("unpaid card is pending not realized", () => {
    const r = periodIncome([card(1, 1, 333.33), card(2, 2, 333.33, false)], []);
    expect(r.total).toBeCloseTo(333.33, 2);
    expect(r.realized).toHaveLength(1);
    expect(r.pending).toEqual([{ studentId: 2, kind: "unpaid", amount: 333.33 }]);
  });

  it("gift card counts 0", () => {
    const r = periodIncome([card(1, 1, cardUnitValue({ finalPrice: 0, totalSessions: 6 }))], []);
    expect(r.total).toBe(0);
    expect(r.realized).toHaveLength(1);
    expect(r.pending).toEqual([]);
  });

  it("multi-session uses sessionsUsed", () => {
    const r = periodIncome([card(1, 1, cardUnitValue({ finalPrice: 2000, totalSessions: 6 }) * 2)], []);
    expect(r.total).toBeCloseTo(666.67, 2);
  });

  it("drop-in uses actual amount", () => {
    const r = periodIncome([{ kind: "dropIn", refId: 1, studentId: 1, amount: 450, paid: true, holderUserId: null }], []);
    expect(r.total).toBe(450);
  });
});
