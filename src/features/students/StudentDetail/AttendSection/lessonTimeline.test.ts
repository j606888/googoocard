import { describe, expect, it } from "vitest";
import type { LessonAttendance } from "@/store/slices/students";
import {
  TIMELINE_MAX_WEEKS,
  buildTimelineAxis,
  lessonWeekCells,
  periodStatus,
  sortLessons,
  summarizeLesson,
} from "./lessonTimeline";

const now = new Date("2026-10-14T12:00:00+08:00"); // 週三

type SlotSpec = [date: string, status: "y" | "n" | "-" | "p"];

const lesson = (lessonId: number, specs: SlotSpec[], extra: Partial<LessonAttendance> = {}): LessonAttendance => ({
  lessonId,
  lessonName: `Lesson ${lessonId}`,
  danceStyle: null,
  level: 1,
  status: "inProgress",
  totalPeriods: specs.length,
  lessonPeriodIds: specs.map((_, index) => lessonId * 100 + index),
  studentAttendances: specs.map(([date, status], index) => ({
    periodId: lessonId * 100 + index,
    periodNumber: index + 1,
    periodStartTime: `${date}T20:00:00+08:00`,
    periodAttendantCheck: status === "y" || status === "n",
    studentAttend: status === "y" || status === "p",
    studentCard: null,
    pending: status === "p",
  })),
  ...extra,
});

describe("periodStatus", () => {
  it("出席（含自助簽到待定案）、點過名沒來是缺席、其餘未點名", () => {
    expect(periodStatus({ studentAttend: true, periodAttendantCheck: true })).toBe("attended");
    expect(periodStatus({ studentAttend: true, periodAttendantCheck: false })).toBe("attended");
    expect(periodStatus({ studentAttend: false, periodAttendantCheck: true })).toBe("absent");
    expect(periodStatus({ studentAttend: false, periodAttendantCheck: false })).toBe("unchecked");
  });
});

describe("summarizeLesson", () => {
  it("出席率只算已有結果的堂數", () => {
    const summary = summarizeLesson(lesson(1, [["2026-09-03", "y"], ["2026-09-10", "n"], ["2026-09-17", "y"], ["2026-09-24", "-"]]));
    expect(summary).toMatchObject({ attended: 2, absent: 1, checked: 3, rate: 67, longestAbsence: null });
  });

  it("最長連續缺課：未點名不中斷、出席才中斷，未滿門檻是 null", () => {
    const summary = summarizeLesson(
      lesson(1, [
        ["2026-04-17", "n"],
        ["2026-04-24", "n"],
        ["2026-05-01", "-"],
        ["2026-05-08", "n"],
        ["2026-05-15", "y"],
        ["2026-05-22", "n"],
      ])
    );
    expect(summary.longestAbsence?.length).toBe(3);
    expect(summary.longestAbsence?.from.periodNumber).toBe(1);
    expect(summary.longestAbsence?.to.periodNumber).toBe(4);

    expect(summarizeLesson(lesson(2, [["2026-04-17", "n"], ["2026-04-24", "y"]])).longestAbsence).toBeNull();
  });

  it("一堂都還沒點名時出席率是 null", () => {
    expect(summarizeLesson(lesson(1, [["2026-10-22", "-"]])).rate).toBeNull();
  });
});

describe("sortLessons", () => {
  it("進行中在前，其餘依最後一堂新的在前", () => {
    const sorted = sortLessons([
      lesson(1, [["2026-05-01", "y"]], { status: "finished" }),
      lesson(2, [["2026-03-01", "y"]], { status: "inProgress" }),
      lesson(3, [["2026-09-01", "y"]], { status: "finished" }),
    ]);
    expect(sorted.map((l) => l.lessonId)).toEqual([2, 3, 1]);
  });
});

describe("buildTimelineAxis / lessonWeekCells", () => {
  it("從最早一堂畫到本週，週一起算，標出本週與每月第一週", () => {
    const axis = buildTimelineAxis([lesson(1, [["2026-09-03", "y"]])], now);
    expect(axis.start.getDay()).toBe(1);
    expect(axis.weeks).toBe(7); // 8/31 那週 … 10/12 那週
    expect(axis.todayIndex).toBe(6);
    expect(axis.months.map((m) => m.month + 1)).toEqual([8, 9, 10]);
  });

  it("排好但還沒上的課讓軸延伸到最後一堂", () => {
    const axis = buildTimelineAxis([lesson(1, [["2026-10-01", "y"], ["2026-10-29", "-"]])], now);
    expect(axis.weeks).toBe(5);
    expect(axis.todayIndex).toBe(2);
  });

  it("最多畫 TIMELINE_MAX_WEEKS 週，太早的課整列落在軸外", () => {
    const axis = buildTimelineAxis([lesson(1, [["2024-01-05", "y"]]), lesson(2, [["2026-10-08", "y"]])], now);
    expect(axis.weeks).toBe(TIMELINE_MAX_WEEKS);
    expect(lessonWeekCells(lesson(1, [["2024-01-05", "y"]]), axis).every((cell) => cell === "none")).toBe(true);
  });

  it("期間內沒排課的週是 gap，同週兩堂有缺就算缺", () => {
    const target = lesson(1, [
      ["2026-09-03", "y"],
      ["2026-09-17", "y"],
      ["2026-09-18", "n"],
      ["2026-10-15", "-"],
    ]);
    const axis = buildTimelineAxis([target], now);
    expect(lessonWeekCells(target, axis)).toEqual(["attended", "gap", "absent", "gap", "gap", "gap", "unchecked"]);
  });
});
