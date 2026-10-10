import { describe, it, expect } from "vitest";
import { LessonSummary } from "@/store/slices/lessons";
import {
  buildLessonSections,
  isFlattenedView,
  shouldUseGroupedView,
  lessonRowAction,
  listAttention,
  nextPeriodDefault,
  UNGROUPED_ID,
} from "./lessonGrouping";

const BACHATA = { id: 1, name: "Bachata", color: "green", hasLevels: false };
const SALSA = { id: 2, name: "Salsa", color: "orange", hasLevels: false };

const lesson = (
  overrides: Partial<LessonSummary> & Pick<LessonSummary, "id">
): LessonSummary =>
  ({
    name: `課程 ${overrides.id}`,
    danceStyleId: BACHATA.id,
    danceStyle: BACHATA,
    status: "inProgress",
    kind: "fixed",
    endedAt: null,
    studentCount: 0,
    groupId: null,
    dueForAttendanceCount: 0,
    dueForAttendancePeriodId: null,
    nextSessionDate: null,
    ...overrides,
  }) as LessonSummary;

describe("buildLessonSections", () => {
  const groups = [
    { id: 1, name: "週日課" },
    { id: 2, name: "週三課" },
  ];

  it("課程分到各自的群組，並加總人數", () => {
    const sections = buildLessonSections(
      [
        lesson({ id: 10, groupId: 1, studentCount: 5 }),
        lesson({ id: 11, groupId: 1, studentCount: 3 }),
        lesson({ id: 12, groupId: 2 }),
      ],
      groups
    );
    expect(sections.map((s) => [s.id, s.lessons.map((l) => l.id), s.studentCount])).toEqual([
      [1, [10, 11], 8],
      [2, [12], 0],
    ]);
  });

  it("群組順序照 groups 給的順序，組內順序照 lessons", () => {
    const sections = buildLessonSections(
      [lesson({ id: 11, groupId: 2 }), lesson({ id: 10, groupId: 2 })],
      groups
    );
    expect(sections.map((s) => s.id)).toEqual([1, 2]);
    expect(sections[1].lessons.map((l) => l.id)).toEqual([11, 10]);
  });

  it("沒有課的群組仍然列出來", () => {
    const sections = buildLessonSections([], groups);
    expect(sections).toHaveLength(2);
    expect(sections.every((s) => s.lessons.length === 0)).toBe(true);
  });

  it("沒有 groupId 的課進未分組，且排在最後", () => {
    const sections = buildLessonSections(
      [lesson({ id: 10, groupId: 1 }), lesson({ id: 11, groupId: null })],
      groups
    );
    expect(sections.at(-1)).toMatchObject({ id: UNGROUPED_ID });
    expect(sections.at(-1)!.lessons.map((l) => l.id)).toEqual([11]);
  });

  it("沒有孤兒課程時不產生未分組", () => {
    const sections = buildLessonSections([lesson({ id: 10, groupId: 1 })], groups);
    expect(sections.some((s) => s.id === UNGROUPED_ID)).toBe(false);
  });

  it("課程的 groupId 指向不存在的群組時不會憑空多出一組", () => {
    const sections = buildLessonSections([lesson({ id: 10, groupId: 999 })], groups);
    expect(sections.map((s) => s.id)).toEqual([1, 2]);
  });
});

describe("isFlattenedView / shouldUseGroupedView", () => {
  it("有關鍵字或舞種篩選就攤平", () => {
    expect(isFlattenedView("bachata", null)).toBe(true);
    expect(isFlattenedView("", SALSA.id)).toBe(true);
    expect(isFlattenedView("", null)).toBe(false);
  });

  it("進行中、沒篩選、有群組時才分組", () => {
    expect(shouldUseGroupedView("", null, 2, "inProgress")).toBe(true);
  });

  it("從沒建過群組的教室維持攤平列表", () => {
    expect(shouldUseGroupedView("", null, 0, "inProgress")).toBe(false);
  });

  it("篩選中即使有群組也攤平", () => {
    expect(shouldUseGroupedView("bachata", null, 2, "inProgress")).toBe(false);
  });

  it("已結束維持分頁的攤平列表", () => {
    expect(shouldUseGroupedView("", null, 2, "finished")).toBe(false);
  });
});

describe("lessonRowAction", () => {
  it("有待點名就點名，優先於排下一堂", () => {
    const l = lesson({ id: 1, kind: "ongoing", dueForAttendanceCount: 1, dueForAttendancePeriodId: 7 });
    expect(lessonRowAction(l)).toEqual({ type: "attend", periodId: 7 });
  });

  it("持續開課、沒有下一堂 → 排下一堂", () => {
    expect(lessonRowAction(lesson({ id: 1, kind: "ongoing" }))).toEqual({ type: "schedule" });
  });

  it("持續開課但已經排了下一堂 → 沒有動作", () => {
    const l = lesson({ id: 1, kind: "ongoing", nextSessionDate: "2030-01-01T10:00:00.000Z" });
    expect(lessonRowAction(l)).toEqual({ type: "none" });
  });

  it("手動結束的持續開課 → 不催排課", () => {
    const l = lesson({ id: 1, kind: "ongoing", endedAt: "2026-10-01T00:00:00.000Z" });
    expect(lessonRowAction(l)).toEqual({ type: "none" });
  });

  it("固定期數沒有下一堂 → 不催排課", () => {
    expect(lessonRowAction(lesson({ id: 1 }))).toEqual({ type: "none" });
  });
});

describe("listAttention", () => {
  it("加總待點名堂數與待排課的課數", () => {
    expect(
      listAttention([
        lesson({ id: 1, dueForAttendanceCount: 2 }),
        lesson({ id: 2, kind: "ongoing" }),
        lesson({ id: 3, kind: "ongoing", nextSessionDate: "2030-01-01T10:00:00.000Z" }),
      ])
    ).toEqual({ dueCount: 2, needsNextCount: 1 });
  });
});

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
