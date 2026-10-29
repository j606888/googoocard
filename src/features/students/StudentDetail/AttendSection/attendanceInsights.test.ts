import { describe, expect, it } from "vitest";
import {
  attendanceSourceLabel,
  countByStyle,
  groupByMonth,
  heatLevel,
  longestGapDays,
  takeMonthsUntil,
  weeklyAverageLabel,
  weeklyCounts,
} from "./attendanceInsights";
import type { StudentAttendance } from "@/store/slices/students";

const now = new Date("2026-10-13T12:00:00+08:00"); // 週二

const at = (startTime: string, extra: Partial<StudentAttendance> = {}): StudentAttendance => ({
  lessonId: 1,
  lessonName: "Bachata Lv2",
  periodNumber: 1,
  totalPeriods: 8,
  startTime,
  danceStyle: null,
  studentCard: null,
  source: "TEACHER",
  pending: false,
  sessionsUsed: 1,
  dropIn: null,
  ...extra,
});

describe("attendanceInsights", () => {
  it("來源標籤：待確認優先於自助簽到", () => {
    expect(attendanceSourceLabel({ source: "STUDENT", pending: true }).label).toBe("待老師確認");
    expect(attendanceSourceLabel({ source: "STUDENT", pending: false }).label).toBe("自助簽到");
    expect(attendanceSourceLabel({ source: "TEACHER", pending: false }).label).toBe("老師點名");
  });

  it("依月份分組，保持新的在前", () => {
    const groups = groupByMonth([
      at("2026-10-08T19:30:00+08:00"),
      at("2026-10-01T19:30:00+08:00"),
      at("2026-09-24T19:30:00+08:00"),
    ]);
    expect(groups.map((g) => [g.label, g.attendances.length])).toEqual([
      ["2026 年 10 月", 2],
      ["2026 年 9 月", 1],
    ]);
  });

  it("整月整月地取到至少 N 筆", () => {
    const groups = groupByMonth([
      at("2026-10-08T19:30:00+08:00"),
      at("2026-10-01T19:30:00+08:00"),
      at("2026-09-24T19:30:00+08:00"),
      at("2026-08-24T19:30:00+08:00"),
    ]);
    expect(takeMonthsUntil(groups, 1).map((g) => g.key)).toEqual(["2026-10"]);
    expect(takeMonthsUntil(groups, 3).map((g) => g.key)).toEqual(["2026-10", "2026-09"]);
    expect(takeMonthsUntil(groups, 99)).toHaveLength(3);
  });

  it("近 13 週每週計數，本週在最後，超過範圍的不算", () => {
    const counts = weeklyCounts(
      [
        at("2026-10-13T19:30:00+08:00"), // 本週
        at("2026-10-12T19:30:00+08:00"), // 本週（週一）
        at("2026-10-06T19:30:00+08:00"), // 上週
        at("2026-07-10T19:30:00+08:00"), // 14 週前：不算
        at("2026-10-20T19:30:00+08:00"), // 未來：不算
      ],
      now
    );
    expect(counts).toHaveLength(13);
    expect(counts[12]).toBe(2);
    expect(counts[11]).toBe(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("方格深淺與平均", () => {
    expect([0, 1, 2, 5].map(heatLevel)).toEqual([0, 1, 2, 3]);
    expect(weeklyAverageLabel(new Array(13).fill(0))).toBeNull();
    expect(weeklyAverageLabel([2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe("平均每週 1.1 堂");
  });

  it("最久間隔包含最後一次到今天", () => {
    expect(longestGapDays([], now)).toBeNull();
    expect(
      longestGapDays([at("2026-10-12T19:30:00+08:00"), at("2026-09-28T19:30:00+08:00"), at("2026-09-21T19:30:00+08:00")], now)
    ).toBe(14);
    expect(longestGapDays([at("2026-09-30T19:30:00+08:00")], now)).toBe(13);
  });

  it("依舞種計數，多的在前，沒有舞種歸一類", () => {
    const ba = { id: 1, name: "Bachata", color: "orange", hasLevels: true };
    const zo = { id: 2, name: "Zouk", color: "purple", hasLevels: false };
    const counts = countByStyle([
      at("2026-10-01T19:30:00+08:00", { danceStyle: zo }),
      at("2026-10-02T19:30:00+08:00", { danceStyle: ba }),
      at("2026-10-03T19:30:00+08:00", { danceStyle: ba }),
      at("2026-10-04T19:30:00+08:00"),
    ]);
    expect(counts.map((c) => [c.style?.name ?? null, c.count])).toEqual([
      ["Bachata", 2],
      ["Zouk", 1],
      [null, 1],
    ]);
  });
});
