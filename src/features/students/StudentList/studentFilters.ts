import { Student } from "@/store/slices/students";
import { SortOption } from "@/components/SortMenu";
import { differenceInCalendarDays } from "date-fns";
import { weeklyCounts } from "../StudentDetail/AttendSection/attendanceInsights";

export interface StudentFilters {
  tags: string[]; // tag name，例 ["Needs Renewal", "未繳費"]
  qualifications: number[]; // danceStyleId
  lessonIds: number[];
  inActiveLesson: boolean;
  recentlyAttended: boolean; // 近 RECENT_ATTEND_DAYS 天內有上過課
  noActiveCard: boolean; // 手上沒有任何剩餘堂數
  lowRemaining: boolean; // 還有堂數、但剩 ≤ LOW_REMAINING_SESSIONS
  unpaid: boolean; // 有未付款的課卡
}

export const EMPTY_FILTERS: StudentFilters = {
  tags: [],
  qualifications: [],
  lessonIds: [],
  inActiveLesson: false,
  recentlyAttended: false,
  noActiveCard: false,
  lowRemaining: false,
  unpaid: false,
};

/** 「近期上課」的界線；也是名單列上「N 天前」轉為提醒色的門檻。 */
export const RECENT_ATTEND_DAYS = 7;

/**
 * 「剩 ≤2 堂」快篩的門檻，也是名單上堂數轉紅的門檻。
 * 只算還有堂數的人——剩 0 堂的歸「無課卡」，不然這顆 chip 會被沒買卡的人灌滿。
 */
export const LOW_REMAINING_SESSIONS = 2;

export const NEEDS_RENEWAL_TAG = "Needs Renewal";

/** 手上所有未過期卡的剩餘堂數總和。 */
export const remainingSessions = (student: Student): number =>
  student.studentCards.reduce(
    (total, card) => total + Math.max(0, card.remainingSessions),
    0
  );

export const isLowRemaining = (student: Student): boolean => {
  const remaining = remainingSessions(student);
  return remaining > 0 && remaining <= LOW_REMAINING_SESSIONS;
};

/** 「今天／昨天／N 天前／尚未上課」——名單列與學生頁首共用。 */
export const lastAttendLabel = (days: number | null): string => {
  if (days === null) return "尚未上課";
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  return `${days} 天前`;
};

/** 距離最近一次上課的天數；從未上過課回 null。 */
export const daysSinceLastAttend = (student: Student): number | null =>
  student.lastAttendAt
    ? differenceInCalendarDays(new Date(), new Date(student.lastAttendAt))
    : null;

/**
 * 名單分區的界線：這麼多天內有出席算「在上課」。比 `RECENT_ATTEND_DAYS`
 * （快篩「近 7 天有上課」）寬——分區要回答的是「這個人還在不在」，不是「這週有沒有來」。
 */
export const ACTIVE_DAYS = 30;

/**
 * 名單的三區：
 * - `active` 在上課 —— ACTIVE_DAYS 天內有出席；從沒上過課但 ACTIVE_DAYS 天內才加入的新生也算
 * - `idle`   有卡沒來 —— 不在上課，但手上還有堂數（已經付錢、卻沒在用）
 * - `gone`   已離開 —— 其他人：很久沒來、也沒有可用的課卡
 */
export type StudentActivity = "active" | "idle" | "gone";

export const activityOf = (student: Student, now = new Date()): StudentActivity => {
  const sinceAttend = student.lastAttendAt
    ? differenceInCalendarDays(now, new Date(student.lastAttendAt))
    : null;
  const isActive =
    sinceAttend !== null
      ? sinceAttend <= ACTIVE_DAYS
      : differenceInCalendarDays(now, new Date(student.createdAt)) <= ACTIVE_DAYS;
  if (isActive) return "active";
  return remainingSessions(student) > 0 ? "idle" : "gone";
};

/** 名單「近 N 週出席」方格的週數。 */
export const ROSTER_WEEKS = 8;

/** 近 ROSTER_WEEKS 週每週出席幾堂（最早那週在前）；跟詳情頁的 13 週方格同一個切法。 */
export const recentWeeks = (student: Student, now = new Date()): number[] =>
  weeklyCounts(
    (student.recentAttendAt ?? []).map((startTime) => ({ startTime })),
    now,
    ROSTER_WEEKS
  );

/** 名單上方的分區選擇；`all` = 三區依序列出。 */
export type ActivityView = "all" | StudentActivity;

const activityStorageKey = (classroomId: number) => `student-activity:${classroomId}`;

export const loadActivityView = (classroomId: number): ActivityView => {
  try {
    const raw = localStorage.getItem(activityStorageKey(classroomId));
    return raw === "active" || raw === "idle" || raw === "gone" ? raw : "all";
  } catch {
    return "all";
  }
};

export const saveActivityView = (classroomId: number, view: ActivityView) => {
  try {
    localStorage.setItem(activityStorageKey(classroomId), view);
  } catch {
    // ignore quota / serialization errors
  }
};

const storageKey = (classroomId: number) => `student-filters:${classroomId}`;

export const loadStudentFilters = (classroomId: number): StudentFilters => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    if (!raw) return EMPTY_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      // Filters saved before dance styles were classroom data hold enum names
      // ("BACHATA"); those would match no one, so only style ids survive.
      qualifications: Array.isArray(parsed.qualifications)
        ? parsed.qualifications.filter((q: unknown) => typeof q === "number")
        : [],
      lessonIds: Array.isArray(parsed.lessonIds) ? parsed.lessonIds : [],
      inActiveLesson: Boolean(parsed.inActiveLesson),
      recentlyAttended: Boolean(parsed.recentlyAttended),
      noActiveCard: Boolean(parsed.noActiveCard),
      lowRemaining: Boolean(parsed.lowRemaining),
      unpaid: Boolean(parsed.unpaid),
    };
  } catch {
    return EMPTY_FILTERS;
  }
};

export const saveStudentFilters = (classroomId: number, filters: StudentFilters) => {
  try {
    localStorage.setItem(storageKey(classroomId), JSON.stringify(filters));
  } catch {
    // ignore quota / serialization errors
  }
};

export const countActiveFilters = (f: StudentFilters): number =>
  f.tags.length +
  f.qualifications.length +
  f.lessonIds.length +
  (f.inActiveLesson ? 1 : 0) +
  (f.recentlyAttended ? 1 : 0) +
  (f.noActiveCard ? 1 : 0) +
  (f.lowRemaining ? 1 : 0) +
  (f.unpaid ? 1 : 0);

export const applyStudentFilters = (
  students: Student[],
  f: StudentFilters
): Student[] =>
  students.filter((s) => {
    // 同類別內 OR，不同類別之間 AND
    if (f.tags.length > 0 && !s.tags?.some((t) => f.tags.includes(t.name))) return false;
    if (
      f.qualifications.length > 0 &&
      !f.qualifications.some((q) => s.danceQualifications?.includes(q))
    )
      return false;
    if (f.lessonIds.length > 0 && !f.lessonIds.some((id) => s.activeLessonIds.includes(id)))
      return false;
    if (f.inActiveLesson && !s.isInActiveLesson) return false;
    if (f.recentlyAttended) {
      const days = daysSinceLastAttend(s);
      if (days === null || days > RECENT_ATTEND_DAYS) return false;
    }
    if (f.noActiveCard && remainingSessions(s) > 0) return false;
    if (f.lowRemaining && !isLowRemaining(s)) return false;
    if (f.unpaid && !s.hasUnpaidCard) return false;
    return true;
  });

export const tagLabel = (name: string): string =>
  name === NEEDS_RENEWAL_TAG ? "需續約" : name;

export type StudentSort = "name" | "number" | "remaining" | "lastAttend";

export const SORT_OPTIONS: SortOption<StudentSort>[] = [
  { value: "name", label: "姓名", short: "姓名" },
  { value: "number", label: "編號", short: "編號" },
  { value: "remaining", label: "剩餘堂數（少到多）", short: "剩餘堂數" },
  { value: "lastAttend", label: "最近上課（久到近）", short: "最近上課" },
];

/** 沒有存過偏好時的排序。編號是老師心裡的固定順序，比姓名筆畫穩定。 */
export const DEFAULT_SORT: StudentSort = "number";

const isStudentSort = (value: string): value is StudentSort =>
  SORT_OPTIONS.some((option) => option.value === value);

/**
 * 排序一律在前端做——列表沒有分頁，資料本來就整份在手上，
 * 「剩餘堂數」「最近上課」也不是 DB 單一欄位排得出來的。
 */
export const sortStudents = (students: Student[], sort: StudentSort): Student[] => {
  const sorted = [...students];
  switch (sort) {
    case "number":
      return sorted.sort((a, b) => a.number - b.number);
    case "remaining":
      return sorted.sort(
        (a, b) =>
          remainingSessions(a) - remainingSessions(b) ||
          a.name.localeCompare(b.name, "zh-Hant")
      );
    case "lastAttend": {
      // 越久沒來排越前面；從未上過課視為最久。
      const staleness = (s: Student) => daysSinceLastAttend(s) ?? Number.POSITIVE_INFINITY;
      return sorted.sort(
        (a, b) => staleness(b) - staleness(a) || a.name.localeCompare(b.name, "zh-Hant")
      );
    }
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }
};

const sortStorageKey = (classroomId: number) => `student-sort:${classroomId}`;

export const loadStudentSort = (classroomId: number): StudentSort => {
  try {
    const raw = localStorage.getItem(sortStorageKey(classroomId));
    return raw && isStudentSort(raw) ? raw : DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
};

export const saveStudentSort = (classroomId: number, sort: StudentSort) => {
  try {
    localStorage.setItem(sortStorageKey(classroomId), sort);
  } catch {
    // ignore quota / serialization errors
  }
};
