// How a lesson runs, which decides when it counts as finished:
// - "fixed"   — a set run of dates (e.g. a 5-week course). Finished once every
//               period has had attendance taken — the original behaviour.
// - "ongoing" — a weekly class that keeps adding periods with no end date.
//               Never finishes on its own; the list offers "＋下一堂" instead.
// Either kind is finished while `endedAt` is set (ended by hand).
export const LESSON_KINDS = [
  { value: "fixed", label: "固定期數" },
  { value: "ongoing", label: "持續開課" },
] as const;

export type LessonKind = (typeof LESSON_KINDS)[number]["value"];

export const DEFAULT_LESSON_KIND: LessonKind = "fixed";

export function isValidLessonKind(value: unknown): value is LessonKind {
  return LESSON_KINDS.some((kind) => kind.value === value);
}

// 每次出席扣幾格課卡（Lesson.sessionsPerAttendance）。外師課常用 2。
export const SESSIONS_PER_ATTENDANCE_OPTIONS = [1, 2, 3] as const;

export const DEFAULT_SESSIONS_PER_ATTENDANCE = 1;

export function isValidSessionsPerAttendance(value: unknown): value is number {
  return SESSIONS_PER_ATTENDANCE_OPTIONS.some((option) => option === value);
}

/** 單堂價：null = 不開放單堂付費；否則 0–100000 的整數。 */
export function isValidDropInPrice(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100000);
}

export type LessonStatus = "inProgress" | "finished";

/** The single rule for Lesson.status — refreshLesson() writes what this returns. */
export function deriveLessonStatus({
  kind,
  endedAt,
  allAttendanceChecked,
}: {
  kind: string;
  endedAt: Date | string | null;
  allAttendanceChecked: boolean;
}): LessonStatus {
  if (endedAt) return "finished";
  if (kind === "ongoing") return "inProgress";
  return allAttendanceChecked ? "finished" : "inProgress";
}
