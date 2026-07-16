import { describe, it, expect } from "vitest";
import { summarizeLessonPeriods } from "./lesson";

// Fixed "now": 2026-07-16 12:00 local. Periods are plain dates so the pure
// function is fully deterministic (no Date.now()).
const NOW = new Date("2026-07-16T12:00:00");

const period = (
  id: number,
  start: string,
  end: string,
  attendanceTakenAt: string | null = null
) => ({ id, startTime: start, endTime: end, attendanceTakenAt });

describe("summarizeLessonPeriods", () => {
  it("returns zeros for a lesson with no periods", () => {
    const s = summarizeLessonPeriods([], NOW);
    expect(s.totalPeriods).toBe(0);
    expect(s.attendedCount).toBe(0);
    expect(s.allAttendanceChecked).toBe(false);
    expect(s.nextSessionDate).toBeNull();
    expect(s.dueForAttendanceCount).toBe(0);
    expect(s.dueForAttendancePeriodId).toBeNull();
    expect(s.lastPeriodEnd).toBeNull();
  });

  it("counts attended periods and flags all-checked", () => {
    const s = summarizeLessonPeriods(
      [
        period(1, "2026-07-01T10:00:00", "2026-07-01T11:00:00", "2026-07-01T11:05:00"),
        period(2, "2026-07-08T10:00:00", "2026-07-08T11:00:00", "2026-07-08T11:05:00"),
      ],
      NOW
    );
    expect(s.totalPeriods).toBe(2);
    expect(s.attendedCount).toBe(2);
    expect(s.allAttendanceChecked).toBe(true);
  });

  it("nextSessionDate is the earliest strictly-future start, ignoring past", () => {
    const s = summarizeLessonPeriods(
      [
        period(1, "2026-07-01T10:00:00", "2026-07-01T11:00:00"),
        period(3, "2026-07-30T10:00:00", "2026-07-30T11:00:00"),
        period(2, "2026-07-22T10:00:00", "2026-07-22T11:00:00"),
      ],
      NOW
    );
    expect(s.nextSessionPeriodId).toBe(2);
    expect(s.nextSessionDate?.toISOString()).toBe(new Date("2026-07-22T10:00:00").toISOString());
  });

  it("dueForAttendance = unchecked periods on or before end of today", () => {
    const s = summarizeLessonPeriods(
      [
        // past, unchecked -> due
        period(1, "2026-07-01T10:00:00", "2026-07-01T11:00:00"),
        // earlier today, unchecked -> due (and earliest -> the CTA target)
        period(2, "2026-07-16T09:00:00", "2026-07-16T10:00:00"),
        // past but already checked -> not due
        period(3, "2026-07-08T10:00:00", "2026-07-08T11:00:00", "2026-07-08T11:05:00"),
        // future, unchecked -> not due
        period(4, "2026-07-22T10:00:00", "2026-07-22T11:00:00"),
      ],
      NOW
    );
    expect(s.dueForAttendanceCount).toBe(2);
    expect(s.dueForAttendancePeriodId).toBe(1); // earliest by start time
    expect(s.nextSessionPeriodId).toBe(4);
  });

  it("lastPeriodEnd tracks the latest end time regardless of order", () => {
    const s = summarizeLessonPeriods(
      [
        period(1, "2026-07-30T10:00:00", "2026-07-30T11:00:00"),
        period(2, "2026-07-01T10:00:00", "2026-07-01T11:00:00"),
      ],
      NOW
    );
    expect(s.lastPeriodEnd?.toISOString()).toBe(new Date("2026-07-30T11:00:00").toISOString());
  });
});
