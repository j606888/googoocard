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
