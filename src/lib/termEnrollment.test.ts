import { describe, expect, it } from "vitest";
import {
  exceedsTermSessions,
  resolveTermInput,
  termAttendanceStatus,
  termShareForPeriod,
} from "./termEnrollment";

describe("resolveTermInput", () => {
  it("undefined when neither field is sent", () => {
    expect(resolveTermInput({})).toBeUndefined();
  });
  it("null/null turns term off", () => {
    expect(resolveTermInput({ termPrice: null, termSessions: null })).toEqual({ termPrice: null, termSessions: null });
  });
  it("needs both fields", () => {
    expect(resolveTermInput({ termPrice: 1600 })).toBe("invalid");
    expect(resolveTermInput({ termSessions: 5 })).toBe("invalid");
    expect(resolveTermInput({ termPrice: 1600, termSessions: 0 })).toBe("invalid");
    expect(resolveTermInput({ termPrice: -1, termSessions: 5 })).toBe("invalid");
  });
  it("accepts a valid pair", () => {
    expect(resolveTermInput({ termPrice: 1600, termSessions: 5 })).toEqual({ termPrice: 1600, termSessions: 5 });
  });
});

describe("termShareForPeriod", () => {
  const enrollments = [
    { price: 1600, sessions: 5 },
    { price: 800, sessions: 5 }, // 舊生半價
    { price: 900, sessions: 3 },
  ];
  it("each enrollment covering the period adds price / sessions", () => {
    expect(termShareForPeriod(0, enrollments)).toEqual({ amount: 320 + 160 + 300, count: 3 });
  });
  it("an enrollment stops after its own sessions", () => {
    expect(termShareForPeriod(3, enrollments)).toEqual({ amount: 480, count: 2 });
    expect(termShareForPeriod(5, enrollments)).toEqual({ amount: 0, count: 0 });
  });
  it("sums to the full price over the term", () => {
    const total = [0, 1, 2, 3, 4].reduce((sum, i) => sum + termShareForPeriod(i, [{ price: 1600, sessions: 5 }]).amount, 0);
    expect(total).toBe(1600);
  });
  it("a student who paid this period by card / drop-in gives up their term share", () => {
    const withIds = [
      { price: 1600, sessions: 5, studentId: 1 },
      { price: 1600, sessions: 5, studentId: 2 },
    ];
    expect(termShareForPeriod(0, withIds, new Set([2]))).toEqual({ amount: 320, count: 1 });
  });
});

describe("exceedsTermSessions", () => {
  it("only limits lessons with a term", () => {
    expect(exceedsTermSessions(6, 5)).toBe(true);
    expect(exceedsTermSessions(5, 5)).toBe(false);
    expect(exceedsTermSessions(60, null)).toBe(false);
  });
});

describe("termAttendanceStatus", () => {
  const base = { periodIndex: 1, sessions: 5, attendanceTaken: true, attended: false, onLeave: false };
  it("absent = taken, not there, no leave", () => {
    expect(termAttendanceStatus(base)).toBe("absent");
  });
  it("leave wins over absent, attendance wins over both", () => {
    expect(termAttendanceStatus({ ...base, onLeave: true })).toBe("leave");
    expect(termAttendanceStatus({ ...base, attended: true, onLeave: true })).toBe("present");
  });
  it("upcoming before attendance is taken; outside past the enrollment's sessions", () => {
    expect(termAttendanceStatus({ ...base, attendanceTaken: false })).toBe("upcoming");
    expect(termAttendanceStatus({ ...base, periodIndex: 5 })).toBe("outside");
  });
});
