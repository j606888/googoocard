import { describe, it, expect } from "vitest";
import {
  attendanceChangeLabel,
  capLessons,
  lessonMeta,
  monthSentence,
  progressLabel,
  slotLabel,
} from "./teacherLessons";

describe("teacher lesson labels", () => {
  // Built from local-time parts so the weekday doesn't depend on the runner's timezone.
  const thursday = new Date(2026, 10, 26, 20, 30).toISOString();

  it("slotLabel: weekday + time, null without a period", () => {
    expect(slotLabel(thursday)).toBe("週四 20:30");
    expect(slotLabel(null)).toBeNull();
  });

  it("lessonMeta: the branch only when the classroom has several", () => {
    const lesson = { slotStart: thursday, location: { name: "台南" } };
    expect(lessonMeta(lesson, true)).toBe("週四 20:30 · 台南");
    expect(lessonMeta(lesson, false)).toBe("週四 20:30");
    expect(lessonMeta({ slotStart: null, location: null }, true)).toBe("還沒排時段");
  });

  it("capLessons: three, then how many are left", () => {
    expect(capLessons([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(capLessons([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3], more: 2 });
  });

  it("progressLabel: fixed lessons count toward the total, ongoing ones just count", () => {
    expect(progressLabel({ kind: "fixed", taughtCount: 3, totalPeriods: 8 })).toBe("第 3／8 堂");
    expect(progressLabel({ kind: "ongoing", taughtCount: 12, totalPeriods: 40 })).toBe("已上 12 堂");
  });

  it("monthSentence: one line, nothing when no period was taken", () => {
    expect(monthSentence({ sessions: 8, attendance: 96, uniqueStudents: 42, avgAttendance: 12 })).toBe(
      "已上 8 堂 · 出席 96 人次 · 42 位學生 · 平均每堂 12 人"
    );
    expect(monthSentence({ sessions: 0, attendance: 0, uniqueStudents: 0, avgAttendance: null })).toBeNull();
  });

  it("attendanceChangeLabel: words, not arrows", () => {
    expect(attendanceChangeLabel(112, 100)).toBe("比上個月多 12%");
    expect(attendanceChangeLabel(95, 100)).toBe("比上個月少 5%");
    expect(attendanceChangeLabel(100, 100)).toBe("跟上個月一樣");
    expect(attendanceChangeLabel(10, 0)).toBeNull();
  });
});
