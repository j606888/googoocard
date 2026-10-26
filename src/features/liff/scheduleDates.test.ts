import { describe, expect, it } from "vitest";
import { dateKeyOf, dayLabel, monthGrid, shiftMonth, taipeiTime } from "./scheduleDates";

describe("scheduleDates", () => {
  it("pads the month to whole Sunday-first weeks", () => {
    const grid = monthGrid("2026-10"); // Oct 1 2026 is a Thursday
    expect(grid.slice(0, 5)).toEqual([null, null, null, null, "2026-10-01"]);
    expect(grid).toContain("2026-10-31");
    expect(grid.length % 7).toBe(0);
  });

  it("shifts across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("labels days and times in Taipei", () => {
    expect(dayLabel("2026-10-28")).toBe("10/28（三）");
    // 2026-10-27T16:30Z is 00:30 on the 28th in Taipei.
    expect(taipeiTime("2026-10-27T16:30:00Z")).toBe("00:30");
    expect(dateKeyOf("2026-10-27T16:30:00Z")).toBe("2026-10-28");
  });
});
