import { describe, it, expect } from "vitest";
import { subDays } from "date-fns";
import type { Student } from "@/store/slices/students";
import { ACTIVE_DAYS, activityOf, recentWeeks, sortStudents } from "./studentFilters";

const NOW = new Date("2026-10-26T12:00:00");

const student = ({
  lastAttendDaysAgo = null,
  createdDaysAgo = 365,
  remaining = 0,
  recentAttendAt,
}: {
  lastAttendDaysAgo?: number | null;
  createdDaysAgo?: number;
  remaining?: number;
  recentAttendAt?: string[];
}) =>
  ({
    lastAttendAt: lastAttendDaysAgo === null ? null : subDays(NOW, lastAttendDaysAgo).toISOString(),
    createdAt: subDays(NOW, createdDaysAgo).toISOString(),
    studentCards: remaining > 0 ? [{ remainingSessions: remaining }] : [],
    recentAttendAt,
  }) as unknown as Student;

describe("activityOf", () => {
  it(`${ACTIVE_DAYS} 天內有出席是「在上課」，不管有沒有卡`, () => {
    expect(activityOf(student({ lastAttendDaysAgo: ACTIVE_DAYS }), NOW)).toBe("active");
    expect(activityOf(student({ lastAttendDaysAgo: 0, remaining: 5 }), NOW)).toBe("active");
  });

  it("超過界線：還有堂數是「有卡沒來」，沒有就是「已離開」", () => {
    expect(activityOf(student({ lastAttendDaysAgo: ACTIVE_DAYS + 1, remaining: 3 }), NOW)).toBe("idle");
    expect(activityOf(student({ lastAttendDaysAgo: ACTIVE_DAYS + 1 }), NOW)).toBe("gone");
  });

  it("從沒上過課：剛加入的新生算在上課，加入很久的看手上有沒有卡", () => {
    expect(activityOf(student({ createdDaysAgo: 2 }), NOW)).toBe("active");
    expect(activityOf(student({ createdDaysAgo: 90, remaining: 10 }), NOW)).toBe("idle");
    expect(activityOf(student({ createdDaysAgo: 90 }), NOW)).toBe("gone");
  });
});

describe("recentWeeks", () => {
  it("8 週一格，本週在最後；超出範圍的不算", () => {
    const weeks = recentWeeks(
      student({
        recentAttendAt: [
          NOW.toISOString(),
          subDays(NOW, 1).toISOString(),
          subDays(NOW, 7).toISOString(),
          subDays(NOW, 62).toISOString(),
        ],
      }),
      NOW
    );
    expect(weeks).toHaveLength(8);
    // NOW 是週一：前一天（週日）和 7 天前都落在上一週
    expect(weeks.slice(-2)).toEqual([2, 1]);
    expect(weeks.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("沒帶 recentAttendAt 時全是 0", () => {
    expect(recentWeeks(student({}), NOW)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("sortStudents", () => {
  const named = (name: string, number: number, remaining: number, lastAttendDaysAgo: number | null) =>
    ({ ...student({ remaining, lastAttendDaysAgo }), name, number }) as Student;
  const list = [
    named("乙", 2, 3, 10),
    named("甲", 1, 3, null),
    named("丙", 3, 1, 2),
  ];
  const names = (students: Student[]) => students.map((s) => s.name);
  // 甲、乙剩餘堂數一樣，同分時的姓名順序
  const tie = ["甲", "乙"].sort((a, b) => a.localeCompare(b, "zh-Hant"));

  it("預設方向維持原本的排法", () => {
    expect(names(sortStudents(list, "number"))).toEqual(["甲", "乙", "丙"]);
    expect(names(sortStudents(list, "remaining"))).toEqual(["丙", ...tie]);
    expect(names(sortStudents(list, "lastAttend"))).toEqual(["甲", "乙", "丙"]);
  });

  it("倒序只反轉主要欄位，同分仍依姓名正序", () => {
    expect(names(sortStudents(list, "number", "desc"))).toEqual(["丙", "乙", "甲"]);
    expect(names(sortStudents(list, "remaining", "desc"))).toEqual([...tie, "丙"]);
    expect(names(sortStudents(list, "lastAttend", "desc"))).toEqual(["丙", "乙", "甲"]);
  });
});
