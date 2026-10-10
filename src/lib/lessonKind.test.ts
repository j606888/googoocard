import { describe, it, expect } from "vitest";
import { deriveLessonStatus } from "./lessonKind";

describe("deriveLessonStatus", () => {
  it("固定期數：全部點完才結束", () => {
    expect(deriveLessonStatus({ kind: "fixed", endedAt: null, allAttendanceChecked: false })).toBe("inProgress");
    expect(deriveLessonStatus({ kind: "fixed", endedAt: null, allAttendanceChecked: true })).toBe("finished");
  });

  it("持續開課：點完也不會自動結束", () => {
    expect(deriveLessonStatus({ kind: "ongoing", endedAt: null, allAttendanceChecked: true })).toBe("inProgress");
  });

  it("手動結束的課，不論型態都是已結束", () => {
    const endedAt = new Date("2026-10-01T00:00:00Z");
    expect(deriveLessonStatus({ kind: "ongoing", endedAt, allAttendanceChecked: false })).toBe("finished");
    expect(deriveLessonStatus({ kind: "fixed", endedAt, allAttendanceChecked: false })).toBe("finished");
  });
});
