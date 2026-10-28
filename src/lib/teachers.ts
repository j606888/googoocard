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
  isAssistant: true,
  archivedAt: true,
} satisfies Prisma.TeacherSelect;
