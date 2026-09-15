import { LessonSummary } from "@/store/slices/lessons";
import { GroupRowData } from "./GroupRow";
import { DanceType } from "@prisma/client";

/**
 * 課程列表的群組彙總與檢視模式規則。全部是純函式——
 * 後端沒有群組彙總端點，這些數字是從已經抓回來的 LessonSummary
 * （每列本來就帶 summarizeLessonPeriods 的 due / next-session 欄位）
 * 在前端 roll up 出來的。
 *
 * 有狀態的部分在 `useLessonsList.ts`。
 */

/** 沒有 groupId 的課程集中到這個虛擬桶。 */
export const UNGROUPED_ID = "ungrouped" as const;
export const UNGROUPED_NAME = "未分類";

/** 把一個群組底下的課程摺成一列 GroupRow 的各個欄位。 */
export const summarizeGroup = (
  id: number | typeof UNGROUPED_ID,
  name: string,
  lessons: LessonSummary[]
): GroupRowData => ({
  id,
  name,
  lessonCount: lessons.length,
  studentCount: lessons.reduce((sum, l) => sum + l.studentCount, 0),
  danceTypes: [...new Set(lessons.map((l) => l.danceType))],
  dueForAttendanceCount: lessons.reduce(
    (sum, l) => sum + l.dueForAttendanceCount,
    0
  ),
  nextSessionDate:
    lessons
      .map((l) => l.nextSessionDate)
      .filter((d): d is string => d !== null)
      .sort()[0] ?? null,
});

/**
 * 有關鍵字或舞種篩選時攤平成傳統的逐堂列表——
 * 「找某一堂特定的課」的意圖跟它在哪個群組無關。
 */
export const isFlattenedView = (
  search: string,
  danceType: DanceType | null
): boolean => Boolean(search || danceType);

/**
 * 沒在篩選、而且至少有一個群組時才用群組檢視。
 * 從沒建過群組的教室看到的就是原本的攤平列表（還沒有東西可以群組）。
 */
export const shouldUseGroupedView = (
  search: string,
  danceType: DanceType | null,
  groupCount: number
): boolean => !isFlattenedView(search, danceType) && groupCount > 0;

/**
 * 把課程分到各自的群組並彙總成列。群組順序照 `groups` 給的順序，
 * 沒有課的群組仍然會出現（列出 0 堂），「未分類」只在真的有孤兒課程時才加。
 */
export const buildGroupRows = (
  lessons: LessonSummary[],
  groups: { id: number; name: string }[]
): GroupRowData[] => {
  const byGroup = new Map<number, LessonSummary[]>();
  const ungrouped: LessonSummary[] = [];
  for (const lesson of lessons) {
    if (lesson.groupId === null) {
      ungrouped.push(lesson);
    } else {
      const list = byGroup.get(lesson.groupId);
      if (list) list.push(lesson);
      else byGroup.set(lesson.groupId, [lesson]);
    }
  }
  const rows = groups.map((g) =>
    summarizeGroup(g.id, g.name, byGroup.get(g.id) ?? [])
  );
  if (ungrouped.length > 0) {
    rows.push(summarizeGroup(UNGROUPED_ID, UNGROUPED_NAME, ungrouped));
  }
  return rows;
};
