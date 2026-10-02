import { describe, it, expect } from "vitest";
import { listValueOf, residualValueOf, suggestConversion } from "./index";

describe("residualValueOf", () => {
  it("is the paid per-session price times remaining sessions", () => {
    expect(residualValueOf({ finalPrice: 4800, totalSessions: 8, remainingSessions: 5 })).toBe(3000);
  });

  it("uses the actual paid price, so a discounted card carries less value", () => {
    expect(residualValueOf({ finalPrice: 4000, totalSessions: 8, remainingSessions: 5 })).toBe(2500);
  });
});

describe("suggestConversion", () => {
  it("rounds an inexact result half-up and flags it", () => {
    // $3,000 ÷ ($5,600 / 8) = 4.2857
    const s = suggestConversion({ residualValue: 3000, targetPrice: 5600, targetSessions: 8 });
    expect(s.suggested).toBe(4);
    expect(s.isExact).toBe(false);
    expect(s.exact).toBeCloseTo(4.2857, 4);
  });

  it("rounds up past .5", () => {
    // $3,000 ÷ ($6,500 / 10) = 4.615
    expect(
      suggestConversion({ residualValue: 3000, targetPrice: 6500, targetSessions: 10 }).suggested
    ).toBe(5);
  });

  it("reports an exact division as exact", () => {
    const s = suggestConversion({ residualValue: 3000, targetPrice: 1500, targetSessions: 5 });
    expect(s).toEqual({ exact: 10, suggested: 10, isExact: true });
  });

  it("never suggests fewer than one session", () => {
    expect(
      suggestConversion({ residualValue: 100, targetPrice: 5600, targetSessions: 8 }).suggested
    ).toBe(1);
  });

  it("falls back to one session for a free target card", () => {
    expect(suggestConversion({ residualValue: 3000, targetPrice: 0, targetSessions: 8 }).suggested).toBe(1);
  });
});

describe("listValueOf", () => {
  it("prices sessions at the target card's list per-session price", () => {
    expect(listValueOf(4, 5600, 8)).toBe(2800);
  });
});
