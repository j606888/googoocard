import { describe, it, expect } from "vitest";
import { nextPeriodDefault } from "./lessonGrouping";

describe("nextPeriodDefault", () => {
  const NOW = new Date("2026-10-10T12:00:00+08:00");

  it("上一堂 + 7 天，時間不變", () => {
    const next = nextPeriodDefault(
      "2026-10-05T14:00:00+08:00",
      "2026-10-05T15:30:00+08:00",
      NOW
    );
    expect(next!.startTime.toISOString()).toBe(new Date("2026-10-12T14:00:00+08:00").toISOString());
    expect(next!.endTime.toISOString()).toBe(new Date("2026-10-12T15:30:00+08:00").toISOString());
  });

  it("停了好幾週的課，推到今天或之後的同一個星期幾", () => {
    const next = nextPeriodDefault(
      "2026-09-01T20:00:00+08:00",
      "2026-09-01T21:00:00+08:00",
      NOW
    );
    expect(next!.startTime.toISOString()).toBe(new Date("2026-10-13T20:00:00+08:00").toISOString());
  });

  it("剛好落在今天就排今天", () => {
    const next = nextPeriodDefault(
      "2026-10-03T19:00:00+08:00",
      "2026-10-03T20:00:00+08:00",
      NOW
    );
    expect(next!.startTime.toISOString()).toBe(new Date("2026-10-10T19:00:00+08:00").toISOString());
  });

  it("沒有上一堂 → null", () => {
    expect(nextPeriodDefault(null, null, NOW)).toBeNull();
  });
});
