import type { Prisma } from "@prisma/client";
import { PALETTE_COLORS, type DanceStyleColor, type PaletteColor } from "@/lib/danceStyles";
import { locationSummarySelect } from "@/lib/locations";

// Teachers reuse the dance-style palette keys (and `danceStyleClasses()` for the
// Tailwind classes), so a teacher's colour can't drift from what the UI knows.
// They also get the extra cool colours dance styles don't offer.
export const TEACHER_COLORS = PALETTE_COLORS;
export type TeacherColor = PaletteColor;

/** Emoji a teacher may show on their avatar instead of their initial (`Teacher.icon`). */
export const TEACHER_ICONS = [
  "⭐", "🔥", "⚡", "🌙", "☀️", "🌈",
  "🌊", "🍀", "🌸", "🌹", "🎵", "🎧",
  "💃", "🕺", "👑", "💎", "🦋", "❤️",
  "🐱", "🐶", "🦊", "🐻", "🐼", "🐰",
  "🦁", "🐯", "🐧", "🦄", "🍑", "🍋",
] as const;
export type TeacherIcon = (typeof TEACHER_ICONS)[number];

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

/** 老師在教室裡做什麼（`Teacher.kind`）。只當助教的不列在排課的老師選單。 */
export const TEACHER_KINDS = ["TEACHER", "ASSISTANT", "BOTH"] as const;
export type TeacherKind = (typeof TEACHER_KINDS)[number];
export const TEACHER_KIND_LABELS: Record<TeacherKind, string> = { TEACHER: "老師", ASSISTANT: "助教", BOTH: "都是" };
export const canTeach = (kind: TeacherKind) => kind !== "ASSISTANT";

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
  icon: true,
  note: true,
  kind: true,
  archivedAt: true,
  locations: { select: locationSummarySelect, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
} satisfies Prisma.TeacherSelect;

/** 選小幫手時的排序：會當助教的（ASSISTANT／BOTH）排前面，其餘照原順序。 */
export function assistantsFirst<T extends { kind: TeacherKind }>(teachers: readonly T[]): T[] {
  const rank = (kind: TeacherKind) => (kind === "TEACHER" ? 1 : 0);
  return [...teachers].sort((a, b) => rank(a.kind) - rank(b.kind));
}

/** 「小美、阿傑 · 小幫手 丁丁」——課程標題下那一行的人名；兩邊都沒有回 null。 */
export function lessonPeopleLabel(
  teachers: readonly { name: string }[],
  assistants: readonly { name: string }[] = []
): string | null {
  const parts = [
    teachers.map((t) => t.name).join("、"),
    assistants.length > 0 ? `小幫手 ${assistants.map((a) => a.name).join("、")}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
