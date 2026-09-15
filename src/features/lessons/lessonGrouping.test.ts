import { describe, it, expect } from "vitest";
import { DanceType } from "@prisma/client";
import { LessonSummary } from "@/store/slices/lessons";
import {
  summarizeGroup,
  buildGroupRows,
  isFlattenedView,
  shouldUseGroupedView,
  UNGROUPED_ID,
} from "./lessonGrouping";

const lesson = (
  overrides: Partial<LessonSummary> & Pick<LessonSummary, "id">
): LessonSummary =>
  ({
    name: `課程 ${overrides.id}`,
    danceType: DanceType.BACHATA,
    status: "inProgress",
    studentCount: 0,
    groupId: null,
    dueForAttendanceCount: 0,
    nextSessionDate: null,
    ...overrides,
  }) as LessonSummary;

describe("summarizeGroup", () => {
  it("加總堂數與人數", () => {
    const row = summarizeGroup(1, "週日課", [
      lesson({ id: 1, studentCount: 5 }),
      lesson({ id: 2, studentCount: 3 }),
    ]);
    expect(row.lessonCount).toBe(2);
    expect(row.studentCount).toBe(8);
  });

  it("舞種去重", () => {
    const row = summarizeGroup(1, "週日課", [
      lesson({ id: 1, danceType: DanceType.BACHATA }),
      lesson({ id: 2, danceType: DanceType.SALSA }),
      lesson({ id: 3, danceType: DanceType.BACHATA }),
    ]);
    expect(row.danceTypes).toEqual([DanceType.BACHATA, DanceType.SALSA]);
  });

  it("取最早的下次上課日", () => {
    const row = summarizeGroup(1, "週日課", [
      lesson({ id: 1, nextSessionDate: "2026-09-20T10:00:00.000Z" }),
      lesson({ id: 2, nextSessionDate: "2026-09-18T10:00:00.000Z" }),
    ]);
    expect(row.nextSessionDate).toBe("2026-09-18T10:00:00.000Z");
  });

  it("全部沒有下次上課日時回 null，不是 undefined", () => {
    const row = summarizeGroup(1, "週日課", [lesson({ id: 1 })]);
    expect(row.nextSessionDate).toBeNull();
  });

  it("忽略 null 的下次上課日", () => {
    const row = summarizeGroup(1, "週日課", [
      lesson({ id: 1, nextSessionDate: null }),
      lesson({ id: 2, nextSessionDate: "2026-09-18T10:00:00.000Z" }),
    ]);
    expect(row.nextSessionDate).toBe("2026-09-18T10:00:00.000Z");
  });

  it("加總待點名數", () => {
    const row = summarizeGroup(1, "週日課", [
      lesson({ id: 1, dueForAttendanceCount: 2 }),
      lesson({ id: 2, dueForAttendanceCount: 1 }),
    ]);
    expect(row.dueForAttendanceCount).toBe(3);
  });

  it("空群組所有數字歸零", () => {
    const row = summarizeGroup(1, "空群組", []);
    expect(row).toMatchObject({
      lessonCount: 0,
      studentCount: 0,
      danceTypes: [],
      dueForAttendanceCount: 0,
      nextSessionDate: null,
    });
  });
});

describe("buildGroupRows", () => {
  const groups = [
    { id: 1, name: "週日課" },
    { id: 2, name: "週三課" },
  ];

  it("課程分到各自的群組", () => {
    const rows = buildGroupRows(
      [lesson({ id: 10, groupId: 1 }), lesson({ id: 11, groupId: 2 })],
      groups
    );
    expect(rows.map((r) => [r.id, r.lessonCount])).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it("群組順序照 groups 給的順序", () => {
    const rows = buildGroupRows([lesson({ id: 10, groupId: 2 })], groups);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("沒有課的群組仍然列出來", () => {
    const rows = buildGroupRows([], groups);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.lessonCount === 0)).toBe(true);
  });

  it("沒有 groupId 的課進未分類桶，且排在最後", () => {
    const rows = buildGroupRows(
      [lesson({ id: 10, groupId: 1 }), lesson({ id: 11, groupId: null })],
      groups
    );
    expect(rows.at(-1)).toMatchObject({ id: UNGROUPED_ID, lessonCount: 1 });
  });

  it("沒有孤兒課程時不產生未分類桶", () => {
    const rows = buildGroupRows([lesson({ id: 10, groupId: 1 })], groups);
    expect(rows.some((r) => r.id === UNGROUPED_ID)).toBe(false);
  });

  it("課程的 groupId 指向不存在的群組時不會憑空多出一列", () => {
    const rows = buildGroupRows([lesson({ id: 10, groupId: 999 })], groups);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("isFlattenedView / shouldUseGroupedView", () => {
  it("有關鍵字就攤平", () => {
    expect(isFlattenedView("bachata", null)).toBe(true);
  });

  it("有舞種篩選就攤平", () => {
    expect(isFlattenedView("", DanceType.SALSA)).toBe(true);
  });

  it("都沒有就不攤平", () => {
    expect(isFlattenedView("", null)).toBe(false);
  });

  it("沒篩選且有群組時用群組檢視", () => {
    expect(shouldUseGroupedView("", null, 2)).toBe(true);
  });

  it("從沒建過群組的教室維持攤平列表", () => {
    expect(shouldUseGroupedView("", null, 0)).toBe(false);
  });

  it("篩選中即使有群組也攤平", () => {
    expect(shouldUseGroupedView("bachata", null, 2)).toBe(false);
  });
});
