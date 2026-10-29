import { describe, it, expect } from "vitest";
import {
  agoLabel,
  inClassPeriod,
  nextDateLabel,
  nextPeriod,
  overduePeriods,
  periodOrdinalLabel,
  pickHero,
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

describe("pickHero", () => {
  it("上課中優先於下一堂", () => {
    const periods = [
      period(1, at(29, 20), at(29, 21)),
      period(2, at(29, 15), at(29, 16), true),
    ];
    expect(pickHero(periods, NOW)).toEqual({ kind: "inClass", period: periods[1] });
  });

  it("沒有上課中 → 最近的下一堂", () => {
    const periods = [
      period(1, at(31, 20), at(31, 21)),
      period(2, at(30, 20), at(30, 21)),
    ];
    expect(pickHero(periods, NOW)).toEqual({ kind: "next", period: periods[1] });
  });

  it("下一堂永遠不會是過去的時段", () => {
    const periods = [period(1, at(22, 20), at(22, 21)), period(2, at(30, 20), at(30, 21))];
    expect(nextPeriod(periods, NOW)?.id).toBe(2);
    expect(pickHero([periods[0]], NOW)).toBeNull();
  });

  it("連著老師時先挑自己教的課，自己沒課才看全教室", () => {
    const periods = [
      period(1, at(29, 15), at(29, 16)),
      period(2, at(30, 20), at(30, 21)),
    ];
    const mine = (p: { id: number }) => p.id === 2;
    expect(pickHero(periods, NOW, mine)).toEqual({ kind: "next", period: periods[1] });
    expect(pickHero(periods, NOW, () => false)).toEqual({ kind: "inClass", period: periods[0] });
  });

  it("剛好下課的那一刻不算上課中", () => {
    expect(inClassPeriod([period(1, at(29, 14, 20), at(29, 15, 20))], NOW)).toBeNull();
  });

  it("兩堂同時在上，取先開始的", () => {
    const periods = [period(1, at(29, 15), at(29, 17)), period(2, at(29, 14), at(29, 16))];
    expect(inClassPeriod(periods, NOW)?.id).toBe(2);
  });
});

describe("overduePeriods", () => {
  it("已開始、還沒點名的，舊的在前；主角那一堂與今天稍後的不算", () => {
    const periods = [
      period(1, at(26, 15), at(26, 16)),
      period(2, at(22, 20), at(22, 21)),
      period(3, at(23, 20), at(23, 21), true),
      period(4, at(29, 15), at(29, 16)),
      period(5, at(29, 20), at(29, 21)),
    ];
    expect(overduePeriods(periods, NOW, 4).map((p) => p.id)).toEqual([2, 1]);
  });

  it("另一堂同時在上、還沒點名 → 也列進還沒點名", () => {
    const periods = [period(1, at(29, 15), at(29, 16)), period(2, at(29, 14), at(29, 16))];
    expect(overduePeriods(periods, NOW, 2).map((p) => p.id)).toEqual([1]);
  });
});

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
