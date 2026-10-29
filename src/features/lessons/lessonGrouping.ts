import { addDays, differenceInCalendarDays, isBefore, startOfDay } from "date-fns";
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

/** 已結束列表的一段：同一個結束月份的課。 */
export interface FinishedSection {
  /** "2026-07"；沒有任何時段的課歸到 "none"。 */
  key: string;
  label: string;
  lessons: LessonSummary[];
}

/** 一次展開的月份段數，其餘收進「更早」。 */
export const FINISHED_VISIBLE_SECTIONS = 3;

/**
 * 已結束分頁依「結束月份」分段，新的在前；段內維持 `lessons` 給的順序。
 * 結束日取最後一堂的結束時間，被手動結束、沒有時段的課退回 `endedAt`。
 * 今年的段落只寫月份，其他年份帶年份——「12/21」到底是哪一年不用再猜。
 */
export const groupByEndMonth = (
  lessons: LessonSummary[],
  now: Date
): FinishedSection[] => {
  const sections = new Map<string, FinishedSection>();
  for (const lesson of lessons) {
    const endIso = lesson.lastPeriodEnd ?? lesson.endedAt;
    const end = endIso ? new Date(endIso) : null;
    const key = end
      ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`
      : "none";
    let section = sections.get(key);
    if (!section) {
      const label = !end
        ? "沒有時段"
        : end.getFullYear() === now.getFullYear()
          ? `${end.getMonth() + 1} 月`
          : `${end.getFullYear()} 年 ${end.getMonth() + 1} 月`;
      section = { key, label, lessons: [] };
      sections.set(key, section);
    }
    section.lessons.push(lesson);
  }
  // "none" sorts last: "none" > any "YYYY-MM" in reverse would put it first.
  return [...sections.values()].sort((a, b) => {
    if (a.key === "none") return 1;
    if (b.key === "none") return -1;
    return b.key.localeCompare(a.key);
  });
};

const ymd = (date: Date, withYear: boolean) =>
  withYear
    ? `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
    : `${date.getMonth() + 1}/${date.getDate()}`;

/**
 * 課程期間「6/21 – 7/26」。開始或結束不在今年時兩端都帶年份，
 * 跨年的課也一樣。只有一堂時只顯示那一天。
 */
export const formatPeriodRange = (
  firstStart: string | null,
  lastEnd: string | null,
  now: Date
): string | null => {
  if (!firstStart || !lastEnd) return null;
  const start = new Date(firstStart);
  const end = new Date(lastEnd);
  const withYear =
    start.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear();
  const startLabel = ymd(start, withYear);
  const endLabel = ymd(end, withYear);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
};

/** 「下一堂」旁邊的相對時間：今天、明天之外的未來日子顯示「N 天後」。 */
export const daysUntilLabel = (date: Date, now: Date): string | null => {
  const days = differenceInCalendarDays(date, now);
  return days >= 2 ? `${days} 天後` : null;
};
