import { describe, it, expect } from "vitest";
import { toTaipeiDateKey, parseTaipeiDateRange } from "./taipei-date";

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
