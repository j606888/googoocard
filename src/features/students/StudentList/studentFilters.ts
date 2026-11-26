import { Student } from "@/store/slices/students";
import { SortDirection, SortOption } from "@/components/SortMenu";
import { differenceInCalendarDays } from "date-fns";
import { weeklyCounts } from "../StudentDetail/AttendSection/attendanceInsights";

export interface StudentFilters {
  tags: string[]; // tag name，例 ["Needs Renewal"]
  qualifications: number[]; // danceStyleId
  /** 名單上方的「上的課」：一次只看一堂進行中的課；null = 所有課。 */
  lessonId: number | null;
  lowRemaining: boolean; // 還有堂數、但剩 ≤ LOW_REMAINING_SESSIONS
  unpaid: boolean; // 有未付款的課卡
  lineUnbound: boolean; // 還沒綁定 LINE
}

export const EMPTY_FILTERS: StudentFilters = {
  tags: [],
  qualifications: [],
  lessonId: null,
  lowRemaining: false,
  unpaid: false,
  lineUnbound: false,
};

/**
 * 「剩 2 堂以下」篩選的門檻，也是名單上堂數轉提醒色的門檻。
 * 只算還有堂數的人——剩 0 堂的是「已經沒卡」，不然這個條件會被沒買卡的人灌滿。
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
 * 名單分區的界線：這麼多天內有出席算「在上課」——分區要回答的是
 * 「這個人還在不在」，不是「這週有沒有來」。
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

/**
 * 讀回存過的篩選。舊版存的條件（`lessonIds`、`inActiveLesson`、`recentlyAttended`、
 * `noActiveCard`）畫面上已經沒有開關了：一律不讀，免得名單被一個關不掉的條件默默濾掉。
 */
export const parseStudentFilters = (raw: string | null): StudentFilters => {
  if (!raw) return EMPTY_FILTERS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_FILTERS;
    const saved = parsed as Record<string, unknown>;
    return {
      tags: Array.isArray(saved.tags)
        ? saved.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      // Filters saved before dance styles were classroom data hold enum names
      // ("BACHATA"); those would match no one, so only style ids survive.
      qualifications: Array.isArray(saved.qualifications)
        ? saved.qualifications.filter((q): q is number => typeof q === "number")
        : [],
      lessonId: typeof saved.lessonId === "number" ? saved.lessonId : null,
      lowRemaining: saved.lowRemaining === true,
      unpaid: saved.unpaid === true,
      lineUnbound: saved.lineUnbound === true,
    };
  } catch {
    return EMPTY_FILTERS;
  }
};

export const loadStudentFilters = (classroomId: number): StudentFilters => {
  try {
    return parseStudentFilters(localStorage.getItem(storageKey(classroomId)));
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

/**
 * 拿掉已經選不到的條件：課結束了、標籤刪了、舞種沒人有資格了——畫面上沒有對應的
 * 開關可以關，留著只會讓名單莫名其妙變短。哪一類的選項還沒載入（`undefined`）就先不動它。
 */
export const pruneStudentFilters = (
  f: StudentFilters,
  available: { lessonIds?: number[]; tagNames?: string[]; qualificationIds?: number[] }
): StudentFilters => {
  const { lessonIds, tagNames, qualificationIds } = available;
  const lessonId =
    f.lessonId !== null && lessonIds && !lessonIds.includes(f.lessonId) ? null : f.lessonId;
  const tags = tagNames ? f.tags.filter((tag) => tagNames.includes(tag)) : f.tags;
  const qualifications = qualificationIds
    ? f.qualifications.filter((id) => qualificationIds.includes(id))
    : f.qualifications;
  // 沒變就回原物件，呼叫端的 useMemo 才不會白跑。
  if (
    lessonId === f.lessonId &&
    tags.length === f.tags.length &&
    qualifications.length === f.qualifications.length
  )
    return f;
  return { ...f, lessonId, tags, qualifications };
};

export const countActiveFilters = (f: StudentFilters): number =>
  f.tags.length +
  f.qualifications.length +
  (f.lessonId !== null ? 1 : 0) +
  (f.lowRemaining ? 1 : 0) +
  (f.unpaid ? 1 : 0) +
  (f.lineUnbound ? 1 : 0);

/**
 * 這位學生在不在這堂（進行中的）課裡：近 63 天有來過那堂課，或報名了整期。
 * 判斷在伺服器做（`recentLessonIds`，GET /api/students）。
 */
export const isInLesson = (student: Student, lessonId: number): boolean =>
  student.recentLessonIds?.includes(lessonId) ?? false;

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
    if (f.lessonId !== null && !isInLesson(s, f.lessonId)) return false;
    if (f.lowRemaining && !isLowRemaining(s)) return false;
    if (f.unpaid && !s.hasUnpaidCard) return false;
    if (f.lineUnbound && s.lineBound !== false) return false;
    return true;
  });

/** 「上的課」選單上一堂課的名字；教室有兩個以上分部時才帶分部，免得每一項都多一截。 */
export const lessonOptionLabel = (
  lesson: { name: string; location?: { name: string } | null },
  showLocation: boolean
): string =>
  showLocation && lesson.location ? `${lesson.name} · ${lesson.location.name}` : lesson.name;

/** 系統標籤「Needs Renewal」在畫面上的說法——跟今天頁同一個詞。 */
export const NEEDS_RENEWAL_LABEL = "已經沒卡";

export const tagLabel = (name: string): string =>
  name === NEEDS_RENEWAL_TAG ? NEEDS_RENEWAL_LABEL : name;

export type StudentSort = "name" | "number" | "remaining" | "lastAttend";

export const SORT_OPTIONS: SortOption<StudentSort>[] = [
  { value: "name", label: "姓名", short: "姓名", directions: ["A→Z", "Z→A"] },
  { value: "number", label: "編號", short: "編號", directions: ["小到大", "大到小"] },
  { value: "remaining", label: "剩餘堂數", short: "剩餘堂數", directions: ["少到多", "多到少"] },
  { value: "lastAttend", label: "最近上課", short: "最近上課", directions: ["久到近", "近到久"] },
];

/** 沒有存過偏好時的排序。編號是老師心裡的固定順序，比姓名筆畫穩定。 */
export const DEFAULT_SORT: StudentSort = "number";

const isStudentSort = (value: string): value is StudentSort =>
  SORT_OPTIONS.some((option) => option.value === value);

/**
 * 排序一律在前端做——列表沒有分頁，資料本來就整份在手上，
 * 「剩餘堂數」「最近上課」也不是 DB 單一欄位排得出來的。
 * desc 只反轉主要欄位；同分時一律再依姓名正序，倒過來也好找人。
 */
export const sortStudents = (
  students: Student[],
  sort: StudentSort,
  direction: SortDirection = "asc"
): Student[] => {
  const sign = direction === "desc" ? -1 : 1;
  const byName = (a: Student, b: Student) => a.name.localeCompare(b.name, "zh-Hant");
  // 越久沒來排越前面；從未上過課視為最久。
  const staleness = (s: Student) => daysSinceLastAttend(s) ?? Number.POSITIVE_INFINITY;
  const primary: (a: Student, b: Student) => number = (() => {
    switch (sort) {
      case "number":
        return (a: Student, b: Student) => a.number - b.number;
      case "remaining":
        return (a: Student, b: Student) => remainingSessions(a) - remainingSessions(b);
      case "lastAttend":
        // Infinity - Infinity 是 NaN，從未上過課的人彼此要算同分
        return (a: Student, b: Student) =>
          staleness(a) === staleness(b) ? 0 : staleness(b) > staleness(a) ? 1 : -1;
      default:
        return byName;
    }
  })();
  return [...students].sort((a, b) => sign * primary(a, b) || byName(a, b));
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

const sortDirectionStorageKey = (classroomId: number) => `student-sort-dir:${classroomId}`;

export const loadStudentSortDirection = (classroomId: number): SortDirection => {
  try {
    return localStorage.getItem(sortDirectionStorageKey(classroomId)) === "desc" ? "desc" : "asc";
  } catch {
    return "asc";
  }
};

export const saveStudentSortDirection = (classroomId: number, direction: SortDirection) => {
  try {
    localStorage.setItem(sortDirectionStorageKey(classroomId), direction);
  } catch {
    // ignore quota / serialization errors
  }
};
