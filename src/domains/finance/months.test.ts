import { describe, it, expect } from "vitest";
import { monthOf, nextMonth } from "./months";

describe("months", () => {
  it("uses Taipei time and rolls over the year", () => {
    expect(monthOf(new Date("2026-10-31T16:30:00Z"))).toBe("2026-11");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(nextMonth("2026-01")).toBe("2026-02");
  });
});
