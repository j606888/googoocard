import { describe, it, expect } from "vitest";
import { financeErrorText, monthLabel, shiftMonth } from "./financeUi";

describe("financeUi", () => {
  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-03")).toBe("2026 年 3 月");
  });
  it("turns API error codes into plain words", () => {
    expect(financeErrorText({ data: { code: "PERIOD_LOCKED" } })).toContain("鎖帳");
    expect(financeErrorText({}, "x")).toBe("x");
  });
});
