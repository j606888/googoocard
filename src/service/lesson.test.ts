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
        // earlier today, unchecked -> due (and today -> the CTA target)
        period(2, "2026-07-16T09:00:00", "2026-07-16T10:00:00"),
        // past but already checked -> not due
        period(3, "2026-07-08T10:00:00", "2026-07-08T11:00:00", "2026-07-08T11:05:00"),
        // future, unchecked -> not due
        period(4, "2026-07-22T10:00:00", "2026-07-22T11:00:00"),
      ],
      NOW
    );
    expect(s.dueForAttendanceCount).toBe(2);
    expect(s.nextSessionPeriodId).toBe(4);
  });

  // The Bailamore bug: a rained-off period that was never checked used to hijack
  // the 點名 CTA and send every later attendance onto the wrong date.
  it("CTA targets today's due period even when an older one is still unchecked", () => {
    const s = summarizeLessonPeriods(
      [
        period(1, "2026-07-01T10:00:00", "2026-07-01T11:00:00"), // stale backlog
        period(2, "2026-07-16T14:00:00", "2026-07-16T15:00:00"), // today
      ],
      NOW
    );
    expect(s.dueForAttendancePeriodId).toBe(2);
    expect(s.dueForAttendanceDate?.toISOString()).toBe(
      new Date("2026-07-16T14:00:00").toISOString()
    );
    expect(s.dueForAttendanceIsBacklog).toBe(false);
    // The backlog is still surfaced — just not by hijacking the CTA.
    expect(s.dueForAttendanceCount).toBe(2);
  });

  it("falls back to the earliest due period when none of them is today", () => {
    const s = summarizeLessonPeriods(
      [
        period(2, "2026-07-08T10:00:00", "2026-07-08T11:00:00"),
        period(1, "2026-07-01T10:00:00", "2026-07-01T11:00:00"),
      ],
      NOW
    );
    expect(s.dueForAttendancePeriodId).toBe(1);
    expect(s.dueForAttendanceIsBacklog).toBe(true);
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
