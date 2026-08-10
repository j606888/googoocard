import { describe, it, expect } from "vitest";
import {
  toTaipeiDateKey,
  parseTaipeiDateRange,
  toTaipeiMonthKey,
  parseTaipeiMonthRange,
} from "./taipei-date";

// 收入彙總用台北時區 (UTC+8, 固定 offset 無 DST) 把時段歸到「哪一天」。
// 邊界很微妙：跨午夜的 UTC 時間必須落在正確的台北日期，否則營收會記錯天。

describe("toTaipeiDateKey", () => {
  it("台北白天 → 當天日期", () => {
    // 2026-06-01 10:00 UTC = 18:00 台北
    expect(toTaipeiDateKey(new Date("2026-06-01T10:00:00Z"))).toBe("2026-06-01");
  });

  it("UTC 仍是前一天、但台北已跨入隔天", () => {
    // 2026-06-01 16:30 UTC = 2026-06-02 00:30 台北
    expect(toTaipeiDateKey(new Date("2026-06-01T16:30:00Z"))).toBe("2026-06-02");
  });

  it("台北午夜整點 → 新的一天", () => {
    // 2026-05-31 16:00 UTC = 2026-06-01 00:00 台北
    expect(toTaipeiDateKey(new Date("2026-05-31T16:00:00Z"))).toBe("2026-06-01");
  });

  it("台北午夜前一秒 → 仍是前一天", () => {
    // 2026-05-31 15:59:59 UTC = 2026-05-31 23:59:59 台北
    expect(toTaipeiDateKey(new Date("2026-05-31T15:59:59Z"))).toBe("2026-05-31");
  });

  it("跨月邊界", () => {
    // 2026-06-30 16:00 UTC = 2026-07-01 00:00 台北
    expect(toTaipeiDateKey(new Date("2026-06-30T16:00:00Z"))).toBe("2026-07-01");
  });
});

describe("parseTaipeiDateRange", () => {
  it("start = 台北當日 00:00 (= 前一天 16:00 UTC)", () => {
    const { start } = parseTaipeiDateRange("2026-06-01");
    expect(start.toISOString()).toBe("2026-05-31T16:00:00.000Z");
  });

  it("end = 隔天台北 00:00 (= 當天 16:00 UTC)，半開區間", () => {
    const { end } = parseTaipeiDateRange("2026-06-01");
    expect(end.toISOString()).toBe("2026-06-01T16:00:00.000Z");
  });

  it("range 恰好涵蓋 24 小時", () => {
    const { start, end } = parseTaipeiDateRange("2026-06-01");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("round-trip: range 內的任一刻 toTaipeiDateKey 都回到同一天", () => {
    const dateKey = "2026-06-01";
    const { start, end } = parseTaipeiDateRange(dateKey);
    expect(toTaipeiDateKey(start)).toBe(dateKey);
    // end 是半開區間的上界，屬於隔天
    expect(toTaipeiDateKey(new Date(end.getTime() - 1))).toBe(dateKey);
    expect(toTaipeiDateKey(end)).not.toBe(dateKey);
  });
});

// 課卡營收用台北時區把「購買時間」歸到哪一個月。月底跨午夜的那幾小時最容易記錯月。

describe("toTaipeiMonthKey", () => {
  it("月中 → 當月", () => {
    expect(toTaipeiMonthKey(new Date("2026-08-15T03:00:00Z"))).toBe("2026-08");
  });

  it("UTC 仍是 7 月底、但台北已跨入 8 月", () => {
    // 2026-07-31 16:00 UTC = 2026-08-01 00:00 台北
    expect(toTaipeiMonthKey(new Date("2026-07-31T16:00:00Z"))).toBe("2026-08");
  });

  it("台北 7 月最後一秒 → 仍是 7 月", () => {
    // 2026-07-31 15:59:59 UTC = 2026-07-31 23:59:59 台北
    expect(toTaipeiMonthKey(new Date("2026-07-31T15:59:59Z"))).toBe("2026-07");
  });

  it("跨年邊界", () => {
    // 2026-12-31 16:00 UTC = 2027-01-01 00:00 台北
    expect(toTaipeiMonthKey(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01");
  });
});

describe("parseTaipeiMonthRange", () => {
  it("start = 台北當月 1 號 00:00 (= 上月最後一天 16:00 UTC)", () => {
    const { start } = parseTaipeiMonthRange("2026-08");
    expect(start.toISOString()).toBe("2026-07-31T16:00:00.000Z");
  });

  it("end = 下個月台北 1 號 00:00，半開區間", () => {
    const { end } = parseTaipeiMonthRange("2026-08");
    expect(end.toISOString()).toBe("2026-08-31T16:00:00.000Z");
  });

  it("12 月 → end 落在隔年 1 月", () => {
    const { start, end } = parseTaipeiMonthRange("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });

  it("round-trip: range 內的任一刻 toTaipeiMonthKey 都回到同一個月", () => {
    const monthKey = "2026-08";
    const { start, end } = parseTaipeiMonthRange(monthKey);
    expect(toTaipeiMonthKey(start)).toBe(monthKey);
    expect(toTaipeiMonthKey(new Date(end.getTime() - 1))).toBe(monthKey);
    expect(toTaipeiMonthKey(end)).not.toBe(monthKey);
  });
});
