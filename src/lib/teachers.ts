import type { Prisma } from "@prisma/client";
import type { DanceStyleColor } from "@/lib/danceStyles";

// Teachers reuse the dance-style palette keys (and `danceStyleClasses()` for the
// Tailwind classes), so a teacher's colour can't drift from what the UI knows.

/** The order new teachers take colours in — the migration that added `color`
 * assigned existing teachers in this same order. */
export const TEACHER_COLOR_ORDER: readonly DanceStyleColor[] = [
  "blue",
  "orange",
  "purple",
  "teal",
  "pink",
  "indigo",
  "red",
  "green",
  "slate",
  "stone",
];

/** First colour no active teacher uses yet, so a new teacher starts distinguishable. */
export function firstFreeTeacherColor(taken: { color: string }[]): DanceStyleColor {
  const used = new Set(taken.map((teacher) => teacher.color));
  return TEACHER_COLOR_ORDER.find((color) => !used.has(color)) ?? TEACHER_COLOR_ORDER[0];
}

/** 老師在教室裡做什麼（`Teacher.kind`）。只當助教的不列在排課的老師選單；只教課的不列在點名的助教選單。 */
export const TEACHER_KINDS = ["TEACHER", "ASSISTANT", "BOTH"] as const;
export type TeacherKind = (typeof TEACHER_KINDS)[number];
export const TEACHER_KIND_LABELS: Record<TeacherKind, string> = { TEACHER: "老師", ASSISTANT: "助教", BOTH: "都是" };
export const canTeach = (kind: TeacherKind) => kind !== "ASSISTANT";
export const canAssist = (kind: TeacherKind) => kind !== "TEACHER";

/** The avatar letter: first character (a whole CJK character or emoji), upper-cased. */
export function teacherInitial(name: string): string {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

/** What lessons embed about their teachers. */
export const teacherSummarySelect = {
  id: true,
  name: true,
  color: true,
} satisfies Prisma.TeacherSelect;

/** The teacher's own fields in API responses — a `select`, never a spread row. */
export const teacherPayloadSelect = {
  ...teacherSummarySelect,
  note: true,
  kind: true,
  archivedAt: true,
} satisfies Prisma.TeacherSelect;
