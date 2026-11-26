import { describe, it, expect } from "vitest";
import { subDays } from "date-fns";
import type { Student } from "@/store/slices/students";
import {
  ACTIVE_DAYS,
  EMPTY_FILTERS,
  NEEDS_RENEWAL_TAG,
  activityOf,
  applyStudentFilters,
  countActiveFilters,
  lessonOptionLabel,
  parseStudentFilters,
  pruneStudentFilters,
  recentWeeks,
  sortStudents,
  tagLabel,
} from "./studentFilters";

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

describe("applyStudentFilters", () => {
  const row = (name: string, fields: Partial<Student>) =>
    ({
      name,
      tags: [],
      danceQualifications: [],
      studentCards: [],
      recentLessonIds: [],
      ...fields,
    }) as unknown as Student;
  const names = (students: Student[]) => students.map((s) => s.name);

  it("上的課：只留 recentLessonIds 有那堂課的人；沒帶這個欄位的不算在課裡", () => {
    const list = [
      row("最近有來", { recentLessonIds: [7, 9] }),
      row("別堂課", { recentLessonIds: [9] }),
      row("沒在上課", { recentLessonIds: [] }),
      row("舊資料", { recentLessonIds: undefined }),
    ];
    expect(names(applyStudentFilters(list, { ...EMPTY_FILTERS, lessonId: 7 }))).toEqual(["最近有來"]);
    expect(names(applyStudentFilters(list, { ...EMPTY_FILTERS, lessonId: 9 }))).toEqual(["最近有來", "別堂課"]);
    expect(applyStudentFilters(list, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("不同條件之間是 AND：上的課＋已經沒卡", () => {
    const renewal = [{ id: 1, name: NEEDS_RENEWAL_TAG }];
    const list = [
      row("在課裡又沒卡", { recentLessonIds: [7], tags: renewal }),
      row("在課裡有卡", { recentLessonIds: [7] }),
      row("沒卡但不在課裡", { tags: renewal }),
    ];
    expect(
      names(applyStudentFilters(list, { ...EMPTY_FILTERS, lessonId: 7, tags: [NEEDS_RENEWAL_TAG] }))
    ).toEqual(["在課裡又沒卡"]);
  });

  it("剩 2 堂以下不含 0 堂；未付款、未綁 LINE 各看各的欄位", () => {
    const cards = (remaining: number) => [{ remainingSessions: remaining }] as unknown as Student["studentCards"];
    const list = [
      row("剩 2", { studentCards: cards(2), hasUnpaidCard: true, lineBound: true }),
      row("剩 0", { studentCards: cards(0), lineBound: false }),
      row("剩 5", { studentCards: cards(5), lineBound: false }),
    ];
    expect(names(applyStudentFilters(list, { ...EMPTY_FILTERS, lowRemaining: true }))).toEqual(["剩 2"]);
    expect(names(applyStudentFilters(list, { ...EMPTY_FILTERS, unpaid: true }))).toEqual(["剩 2"]);
    expect(names(applyStudentFilters(list, { ...EMPTY_FILTERS, lineUnbound: true }))).toEqual(["剩 0", "剩 5"]);
  });
});

describe("parseStudentFilters（localStorage 還原）", () => {
  it("沒存過、壞掉的 JSON、不是物件：都回空條件", () => {
    expect(parseStudentFilters(null)).toEqual(EMPTY_FILTERS);
    expect(parseStudentFilters("{not json")).toEqual(EMPTY_FILTERS);
    expect(parseStudentFilters("null")).toEqual(EMPTY_FILTERS);
    expect(parseStudentFilters('"text"')).toEqual(EMPTY_FILTERS);
  });

  it("舊版存的、已經拿掉的條件一律不讀，也不會變成別的條件", () => {
    const old = JSON.stringify({
      tags: [NEEDS_RENEWAL_TAG],
      qualifications: [3, "BACHATA"],
      lessonIds: [7, 9],
      inActiveLesson: true,
      recentlyAttended: true,
      noActiveCard: true,
      lowRemaining: true,
      unpaid: false,
      lineUnbound: true,
    });
    const restored = parseStudentFilters(old);
    expect(restored).toEqual({
      tags: [NEEDS_RENEWAL_TAG],
      qualifications: [3],
      lessonId: null,
      lowRemaining: true,
      unpaid: false,
      lineUnbound: true,
    });
    // 只算畫面上還有開關的條件
    expect(countActiveFilters(restored)).toBe(4);
  });

  it("新版的 lessonId 讀得回來；不是數字就當沒選", () => {
    expect(parseStudentFilters(JSON.stringify({ lessonId: 12 })).lessonId).toBe(12);
    expect(parseStudentFilters(JSON.stringify({ lessonId: "12" })).lessonId).toBeNull();
    expect(parseStudentFilters(JSON.stringify({ tags: [1, "VIP", null] })).tags).toEqual(["VIP"]);
  });
});

describe("pruneStudentFilters", () => {
  const saved = { ...EMPTY_FILTERS, lessonId: 7, tags: [NEEDS_RENEWAL_TAG, "已刪掉的標籤"], qualifications: [3, 4] };

  it("課結束了、標籤刪了、舞種不在了：那個條件就不算數", () => {
    expect(
      pruneStudentFilters(saved, { lessonIds: [8], tagNames: [NEEDS_RENEWAL_TAG], qualificationIds: [4] })
    ).toEqual({ ...EMPTY_FILTERS, lessonId: null, tags: [NEEDS_RENEWAL_TAG], qualifications: [4] });
  });

  it("選項還沒載入（undefined）時先不動；都還選得到就回原物件", () => {
    expect(pruneStudentFilters(saved, {})).toBe(saved);
    expect(
      pruneStudentFilters(saved, {
        lessonIds: [7],
        tagNames: [NEEDS_RENEWAL_TAG, "已刪掉的標籤"],
        qualificationIds: [3, 4],
      })
    ).toBe(saved);
  });

  it("教室一堂進行中的課都沒有時，存著的課也清掉", () => {
    expect(pruneStudentFilters(saved, { lessonIds: [] }).lessonId).toBeNull();
  });
});

describe("名單上的用字", () => {
  it("上的課：兩個以上分部才帶分部名", () => {
    const lesson = { name: "Bachata Lv1", location: { name: "台南" } };
    expect(lessonOptionLabel(lesson, true)).toBe("Bachata Lv1 · 台南");
    expect(lessonOptionLabel(lesson, false)).toBe("Bachata Lv1");
    expect(lessonOptionLabel({ name: "Salsa", location: null }, true)).toBe("Salsa");
  });

  it("系統標籤 Needs Renewal 顯示成「已經沒卡」，其他標籤照原名", () => {
    expect(tagLabel(NEEDS_RENEWAL_TAG)).toBe("已經沒卡");
    expect(tagLabel("VIP")).toBe("VIP");
  });
});
