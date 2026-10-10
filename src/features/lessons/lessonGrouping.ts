import { addDays, isBefore, startOfDay } from "date-fns";
import { LessonSummary } from "@/store/slices/lessons";

/**
 * 課程列表的分組、每列動作與提醒規則。全部是純函式——
 * 後端沒有群組彙總端點，這些都是從已經抓回來的 LessonSummary
 * （每列本來就帶 summarizeLessonPeriods 的 due / next-session 欄位）推出來的。
 *
 * 有狀態的部分在 `useLessonsList.ts`。
 */

/** 沒有 groupId 的課程集中到這個虛擬桶。 */
export const UNGROUPED_ID = "ungrouped" as const;
export const UNGROUPED_NAME = "未分組";

export type SectionId = number | typeof UNGROUPED_ID;

/** 列表上一個展開的群組：標題列 + 底下的課。 */
export interface LessonSection {
  id: SectionId;
  name: string;
  lessons: LessonSummary[];
  studentCount: number;
}

/**
 * 有關鍵字或舞種篩選時攤平成逐堂列表——
 * 「找某一堂特定的課」的意圖跟它在哪個群組無關。
 */
export const isFlattenedView = (
  search: string,
  danceStyleId: number | null
): boolean => Boolean(search || danceStyleId);

/**
 * 沒在篩選、在「進行中」、而且至少有一個群組時才分組。
 * 「已結束」會一直長，維持分頁的攤平列表；從沒建過群組的教室也是攤平列表。
 */
export const shouldUseGroupedView = (
  search: string,
  danceStyleId: number | null,
  groupCount: number,
  tab: string
): boolean =>
  tab === "inProgress" && !isFlattenedView(search, danceStyleId) && groupCount > 0;

/**
 * 把課程分到各自的群組。群組順序照 `groups` 給的順序，組內順序照 `lessons`
 * （也就是使用者選的排序）。沒有課的群組仍然會出現，好讓人「在這組開課」；
 * 「未分組」只在真的有孤兒課程時才加。
 */
export const buildLessonSections = (
  lessons: LessonSummary[],
  groups: { id: number; name: string }[]
): LessonSection[] => {
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
  const section = (id: SectionId, name: string, list: LessonSummary[]): LessonSection => ({
    id,
    name,
    lessons: list,
    studentCount: list.reduce((sum, l) => sum + l.studentCount, 0),
  });
  const sections = groups.map((g) => section(g.id, g.name, byGroup.get(g.id) ?? []));
  if (ungrouped.length > 0) {
    sections.push(section(UNGROUPED_ID, UNGROUPED_NAME, ungrouped));
  }
  return sections;
};

/**
 * 持續開課、沒被手動結束、而且沒有任何排好的下一堂 —— 列表要給「＋下一堂」。
 * 有待點名的時段時先點名（`lessonRowAction` 的優先序）。
 */
export const needsNextPeriod = (lesson: LessonSummary): boolean =>
  lesson.kind === "ongoing" && !lesson.endedAt && lesson.nextSessionDate === null;

export type LessonRowAction =
  | { type: "attend"; periodId: number }
  | { type: "schedule" }
  | { type: "none" };

/** 每一列右邊那顆按鈕：待點名 > 排下一堂 > 沒有。 */
export const lessonRowAction = (lesson: LessonSummary): LessonRowAction => {
  if (lesson.dueForAttendanceCount > 0 && lesson.dueForAttendancePeriodId !== null) {
    return { type: "attend", periodId: lesson.dueForAttendancePeriodId };
  }
  if (needsNextPeriod(lesson)) return { type: "schedule" };
  return { type: "none" };
};

/** 列表頂端的提醒條：幾堂待點名、幾門持續開課的課還沒排下一堂。 */
export const listAttention = (lessons: LessonSummary[]) => ({
  dueCount: lessons.reduce((sum, l) => sum + l.dueForAttendanceCount, 0),
  needsNextCount: lessons.filter(needsNextPeriod).length,
});

/**
 * 「＋下一堂」的預設時段：沿用上一堂的星期與時間，往後推整週，
 * 推到今天或之後為止（停了幾週的課不會預設排在過去）。沒有上一堂時回 null。
 */
export const nextPeriodDefault = (
  lastPeriodStart: string | null,
  lastPeriodEnd: string | null,
  now: Date
): { startTime: Date; endTime: Date } | null => {
  if (!lastPeriodStart || !lastPeriodEnd) return null;
  let startTime = new Date(lastPeriodStart);
  let endTime = new Date(lastPeriodEnd);
  const today = startOfDay(now);
  do {
    startTime = addDays(startTime, 7);
    endTime = addDays(endTime, 7);
  } while (isBefore(startTime, today));
  return { startTime, endTime };
};
