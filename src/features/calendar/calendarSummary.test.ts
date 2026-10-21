import { describe, expect, it } from "vitest";
import { CalendarPeriod } from "@/store/slices/lessons";
import { filterByStyle, NO_STYLE_KEY, summarizeMonth } from "./calendarSummary";

const period = (overrides: Partial<CalendarPeriod>): CalendarPeriod => ({
  periodId: 1,
  lessonId: 1,
  lessonName: "Salsa",
  danceStyleId: 1,
  danceStyle: null,
  lessonStatus: "inProgress",
  startTime: "2026-10-05T11:30:00.000Z",
  endTime: "2026-10-05T13:00:00.000Z",
  attendanceTaken: false,
  attendeeCount: 0,
  teacherNames: [],
  ...overrides,
});

const NOW = new Date("2026-10-21T07:00:00.000Z");
const OCTOBER = new Date(2026, 9, 1);

describe("summarizeMonth", () => {
  it("counts taken, due and attendees within the month only", () => {
    const summary = summarizeMonth(
      [
        period({ periodId: 1, attendanceTaken: true, attendeeCount: 8 }),
        period({ periodId: 2, startTime: "2026-10-13T12:00:00.000Z" }),
        period({ periodId: 3, startTime: "2026-10-10T12:00:00.000Z" }),
        period({ periodId: 4, startTime: "2026-10-28T12:00:00.000Z" }),
        // Leading day from September shown in the grid — not counted.
        period({ periodId: 5, startTime: "2026-09-29T12:00:00.000Z" }),
      ],
      OCTOBER,
      NOW
    );

    expect(summary.total).toBe(4);
    expect(summary.taken).toBe(1);
    expect(summary.attendees).toBe(8);
    expect(summary.due.map((p) => p.periodId)).toEqual([3, 2]);
  });
});

describe("filterByStyle", () => {
  const periods = [
    period({ periodId: 1, danceStyleId: 1 }),
    period({ periodId: 2, danceStyleId: 2 }),
    period({ periodId: 3, danceStyleId: null }),
  ];

  it("keeps everything without a filter", () => {
    expect(filterByStyle(periods, null)).toHaveLength(3);
  });

  it("matches a style id, or sessions with no style", () => {
    expect(filterByStyle(periods, 2).map((p) => p.periodId)).toEqual([2]);
    expect(filterByStyle(periods, NO_STYLE_KEY).map((p) => p.periodId)).toEqual([3]);
  });
});
