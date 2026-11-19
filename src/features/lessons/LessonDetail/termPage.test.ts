import { describe, it, expect } from "vitest";
import { buildTimeline, termOverview } from "./termPage";

const periods = (taken: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    attendanceTakenAt: i < taken ? "2026-11-01T00:00:00Z" : null,
  }));

describe("termOverview", () => {
  it("shows taken over total for a fixed term and the average headcount", () => {
    expect(termOverview(periods(2, 6), [5, 8], "fixed")).toEqual({ sessions: "2 / 6", average: "6.5 人" });
  });

  it("drops the total for an ongoing lesson and the trailing .0", () => {
    expect(termOverview(periods(6, 9), [4, 4, 4], "ongoing")).toEqual({ sessions: "6 堂", average: "4 人" });
  });

  it("has no average before the first attendance", () => {
    expect(termOverview(periods(0, 6), [], "fixed")).toEqual({ sessions: "0 / 6", average: "—" });
  });
});

describe("buildTimeline", () => {
  it("shows a short term whole, oldest first, numbered from 1", () => {
    const timeline = buildTimeline(periods(2, 6));
    expect(timeline.focusId).toBe(3);
    expect(timeline.rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(timeline).toMatchObject({ earlierHidden: 0, laterHidden: 0 });
  });

  it("folds a long lesson around the first period that still needs attendance", () => {
    const timeline = buildTimeline(periods(20, 30));
    expect(timeline.focusId).toBe(21);
    expect(timeline.rows.map((r) => r.number)).toEqual([18, 19, 20, 21, 22, 23, 24, 25]);
    expect(timeline).toMatchObject({ earlierHidden: 17, laterHidden: 5 });
  });

  it("opens either end on request", () => {
    const all = buildTimeline(periods(20, 30), { showEarlier: true, showLater: true });
    expect(all.rows).toHaveLength(30);
    expect(all).toMatchObject({ earlierHidden: 0, laterHidden: 0 });
    expect(buildTimeline(periods(20, 30), { showEarlier: true }).rows.at(-1)!.number).toBe(25);
  });

  it("prefers today's period over an older one that was never checked", () => {
    const now = new Date(2026, 10, 20, 9);
    const day = (d: number) => new Date(2026, 10, d, 19, 30).toISOString();
    const list = [
      { id: 1, attendanceTakenAt: "x", startTime: day(10) },
      { id: 2, attendanceTakenAt: null, startTime: day(17) },
      { id: 3, attendanceTakenAt: null, startTime: day(20) },
    ];
    expect(buildTimeline(list, { now }).focusId).toBe(3);
    expect(buildTimeline(list).focusId).toBe(2);
    // 今天那一堂點完了，就回到最舊的還沒點名。
    list[2].attendanceTakenAt = "x";
    expect(buildTimeline(list, { now }).focusId).toBe(2);
  });

  it("ends on the last period when everything is taken", () => {
    const timeline = buildTimeline(periods(10, 10));
    expect(timeline.focusId).toBeNull();
    expect(timeline.rows.map((r) => r.number)).toEqual([8, 9, 10]);
    expect(timeline.earlierHidden).toBe(7);
  });

  it("handles a lesson with no periods", () => {
    expect(buildTimeline([])).toEqual({ focusId: null, rows: [], earlierHidden: 0, laterHidden: 0 });
  });
});
