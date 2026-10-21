import { describe, it, expect } from "vitest";
import {
  monthlyTrend,
  monthsEndingAt,
  periodState,
  shiftMonth,
  summarizeMonth,
  topStudents,
  type StatPeriod,
} from "./teacherStats";

const now = new Date("2026-10-21T12:00:00Z");

function period(
  start: string,
  { taken = true, studentIds = [] as number[] }: { taken?: boolean; studentIds?: number[] } = {}
): StatPeriod {
  const startTime = new Date(start);
  return {
    startTime,
    endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
    attendanceTakenAt: taken ? startTime : null,
    studentIds,
  };
}

describe("shiftMonth / monthsEndingAt", () => {
  it("crosses year boundaries both ways", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-10", -13)).toBe("2025-09");
  });

  it("lists the months ending at the given one, oldest first", () => {
    expect(monthsEndingAt("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("periodState", () => {
  it("done once attendance is taken, even for a future period", () => {
    expect(periodState(period("2026-10-30T12:00:00Z"), now)).toBe("done");
  });

  it("pending once it's over unmarked, upcoming before that", () => {
    expect(periodState(period("2026-10-20T12:00:00Z", { taken: false }), now)).toBe("pending");
    expect(periodState(period("2026-10-21T11:30:00Z", { taken: false }), now)).toBe("upcoming");
  });
});

describe("summarizeMonth", () => {
  it("counts only taught periods; unmarked ones are pending, not sessions", () => {
    const summary = summarizeMonth(
      [
        period("2026-10-01T12:00:00Z", { studentIds: [1, 2, 3] }),
        period("2026-10-08T12:00:00Z", { studentIds: [2, 3] }),
        // Self check-ins on an unmarked period don't count yet.
        period("2026-10-15T12:00:00Z", { taken: false, studentIds: [4] }),
        period("2026-10-29T12:00:00Z", { taken: false }),
      ],
      now
    );
    expect(summary).toEqual({
      sessions: 2,
      pendingCount: 1,
      attendance: 5,
      uniqueStudents: 3,
      avgAttendance: 2.5,
    });
  });

  it("has no average when nothing was taught", () => {
    expect(summarizeMonth([], now).avgAttendance).toBeNull();
  });
});

describe("monthlyTrend", () => {
  it("buckets by Taipei month and skips untaught periods", () => {
    const trend = monthlyTrend(
      [
        // 2026-09-30 17:00 UTC = 2026-10-01 01:00 in Taipei → October.
        period("2026-09-30T17:00:00Z", { studentIds: [1] }),
        period("2026-09-10T12:00:00Z", { studentIds: [1, 2] }),
        period("2026-09-17T12:00:00Z", { taken: false, studentIds: [3] }),
        // Outside the window.
        period("2026-05-10T12:00:00Z", { studentIds: [1] }),
      ],
      ["2026-09", "2026-10"]
    );
    expect(trend).toEqual([
      { month: "2026-09", sessions: 1, attendance: 2 },
      { month: "2026-10", sessions: 1, attendance: 1 },
    ]);
  });
});

describe("topStudents", () => {
  it("ranks by taught attendance, ties to the lower id", () => {
    const top = topStudents(
      [
        period("2026-10-01T12:00:00Z", { studentIds: [5, 3, 9] }),
        period("2026-10-08T12:00:00Z", { studentIds: [5, 3] }),
        period("2026-10-15T12:00:00Z", { taken: false, studentIds: [9, 9] }),
      ],
      2
    );
    expect(top).toEqual([
      { studentId: 3, count: 2 },
      { studentId: 5, count: 2 },
    ]);
  });
});
