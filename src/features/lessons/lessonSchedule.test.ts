import { describe, it, expect } from "vitest";
import {
  agoLabel,
  nextDateLabel,
  periodOrdinalLabel,
  relativeDayLabel,
  timeLeftLabel,
  weeklyScheduleLabel,
} from "./lessonSchedule";

// Local-time constructors so the HH:mm / weekday assertions hold in any TZ.
// 2026-10-29 is a Thursday.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const iso = (d: Date) => d.toISOString();

const period = (
  id: number,
  start: Date,
  end: Date,
  taken = false
) => ({
  id,
  startTime: iso(start),
  endTime: iso(end),
  attendanceTakenAt: taken ? iso(end) : null,
});

const NOW = at(29, 15, 20);

describe("labels", () => {
  it("relativeDayLabel", () => {
    expect(relativeDayLabel(at(29, 20), NOW)).toBe("今天");
    expect(relativeDayLabel(at(30, 20), NOW)).toBe("明天（五）");
    expect(relativeDayLabel(new Date(2026, 10, 2, 20), NOW)).toBe("11/2（一）");
  });

  it("nextDateLabel", () => {
    expect(nextDateLabel(at(29, 20), NOW)).toBe("今天 20:00");
    expect(nextDateLabel(at(30, 20), NOW)).toBe("明天");
    expect(nextDateLabel(new Date(2026, 10, 1, 14), NOW)).toBe("11/1（日）");
  });

  it("agoLabel", () => {
    expect(agoLabel(at(29, 10), NOW)).toBe("今天");
    expect(agoLabel(at(28, 20), NOW)).toBe("昨天");
    expect(agoLabel(at(22, 20), NOW)).toBe("7 天前");
  });

  it("timeLeftLabel", () => {
    expect(timeLeftLabel(at(29, 16), NOW)).toBe("還有 40 分鐘");
    expect(timeLeftLabel(at(29, 17, 40), NOW)).toBe("還有 2 小時 20 分");
    expect(timeLeftLabel(at(29, 16, 20), NOW)).toBe("還有 1 小時");
  });

  it("periodOrdinalLabel", () => {
    expect(periodOrdinalLabel(4, 4, "fixed")).toBe("第 4 堂（最後一堂）");
    expect(periodOrdinalLabel(3, 4, "fixed")).toBe("第 3 堂");
    expect(periodOrdinalLabel(9, 9, "ongoing")).toBe("第 9 堂");
  });
});

describe("weeklyScheduleLabel", () => {
  it("每堂同一個星期幾、同一個時間 → 每週五 20:00–21:00", () => {
    expect(
      weeklyScheduleLabel([
        period(1, at(9, 20), at(9, 21)),
        period(2, at(16, 20), at(16, 21)),
        period(3, at(23, 20), at(23, 21)),
      ])
    ).toBe("每週五 20:00–21:00");
  });

  it("時間不一樣或沒有時段 → null", () => {
    expect(
      weeklyScheduleLabel([period(1, at(9, 20), at(9, 21)), period(2, at(16, 19), at(16, 21))])
    ).toBeNull();
    expect(weeklyScheduleLabel([])).toBeNull();
  });
});
