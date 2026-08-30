import { DanceType } from "@prisma/client";
import { Student } from "@/store/slices/students";
import { differenceInCalendarDays } from "date-fns";

export interface StudentFilters {
  tags: string[]; // tag name，例 ["Needs Renewal", "未繳費"]
  qualifications: DanceType[];
  lessonIds: number[];
  inActiveLesson: boolean;
  recentlyAttended: boolean; // 近 RECENT_ATTEND_DAYS 天內有上過課
  noActiveCard: boolean; // 手上沒有任何剩餘堂數
}

export const EMPTY_FILTERS: StudentFilters = {
  tags: [],
  qualifications: [],
  lessonIds: [],
  inActiveLesson: false,
  recentlyAttended: false,
  noActiveCard: false,
};

/** 「近期上課」的界線；也是名單列上「N 天前」轉為提醒色的門檻。 */
export const RECENT_ATTEND_DAYS = 7;

const NEEDS_RENEWAL_TAG = "Needs Renewal";

/** 手上所有未過期卡的剩餘堂數總和。 */
export const remainingSessions = (student: Student): number =>
  student.studentCards.reduce(
    (total, card) => total + Math.max(0, card.remainingSessions),
    0
  );

/** 距離最近一次上課的天數；從未上過課回 null。 */
export const daysSinceLastAttend = (student: Student): number | null =>
  student.lastAttendAt
    ? differenceInCalendarDays(new Date(), new Date(student.lastAttendAt))
    : null;

const storageKey = (classroomId: number) => `student-filters:${classroomId}`;

export const loadStudentFilters = (classroomId: number): StudentFilters => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    if (!raw) return EMPTY_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      qualifications: Array.isArray(parsed.qualifications) ? parsed.qualifications : [],
      lessonIds: Array.isArray(parsed.lessonIds) ? parsed.lessonIds : [],
      inActiveLesson: Boolean(parsed.inActiveLesson),
      recentlyAttended: Boolean(parsed.recentlyAttended),
      noActiveCard: Boolean(parsed.noActiveCard),
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
  (f.noActiveCard ? 1 : 0);

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
    return true;
  });

export const tagLabel = (name: string): string =>
  name === NEEDS_RENEWAL_TAG ? "需續約" : name;

export type StudentSort = "name" | "number" | "remaining" | "lastAttend";

export const SORT_OPTIONS: {
  value: StudentSort;
  /** 選單裡的完整說明（帶方向） */
  label: string;
  /** 收合時顯示在按鈕上的短標籤 */
  short: string;
}[] = [
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
