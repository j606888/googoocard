import type { Prisma } from "@prisma/client";
import { PALETTE_COLORS, type PaletteColor } from "@/lib/danceStyles";
import { locationSummarySelect } from "@/lib/locations";

// Teachers reuse the dance-style palette keys, so a teacher's colour can't drift from
// what the UI knows. The avatar (`TeacherAvatar`) is the only thing drawn from it:
// colour is the one choice — the icon picker was removed 2026-11-26 (`Teacher.icon`
// stays in the DB, unused and never returned).
export const TEACHER_COLORS = PALETTE_COLORS;
export type TeacherColor = PaletteColor;

/**
 * The swatches the teacher form offers. No orange/red (they read as 警告／錯誤, same as
 * `DANCE_STYLE_PRESETS`) and one of each near-identical pair — on the avatar's pale tint
 * periwinkle≈indigo, navy≈blue, plum／violet≈purple, midnight≈slate, emerald≈green, cyan≈sky.
 * Every key in `TEACHER_COLORS` stays valid: a teacher already on a dropped colour keeps it
 * (the form lists it as an extra swatch) until someone picks another.
 */
export const TEACHER_COLOR_PRESETS = [
  "green",
  "teal",
  "sky",
  "blue",
  "indigo",
  "purple",
  "pink",
  "slate",
  "stone",
] as const satisfies readonly TeacherColor[];

/** The order new teachers take colours in: the presets, neighbours in hue kept apart. */
export const TEACHER_COLOR_ORDER: readonly TeacherColor[] = [
  "blue",
  "purple",
  "teal",
  "pink",
  "indigo",
  "green",
  "sky",
  "slate",
  "stone",
];

/** First colour no active teacher uses yet, so a new teacher starts distinguishable. */
export function firstFreeTeacherColor(taken: { color: string }[]): TeacherColor {
  const used = new Set(taken.map((teacher) => teacher.color));
  return TEACHER_COLOR_ORDER.find((color) => !used.has(color)) ?? TEACHER_COLOR_ORDER[0];
}

/**
 * 這個人在課程裡做什麼（`Teacher.kind`）。只當小幫手的不列在排課的老師選單；
 * 不上課的（團隊裡只管事的管理員）兩邊都不列。
 */
export const TEACHER_KINDS = ["TEACHER", "ASSISTANT", "BOTH", "NONE"] as const;
export type TeacherKind = (typeof TEACHER_KINDS)[number];
export const TEACHER_KIND_LABELS: Record<TeacherKind, string> = {
  TEACHER: "老師",
  ASSISTANT: "小幫手",
  BOTH: "老師＋小幫手",
  NONE: "不上課",
};
export const canTeach = (kind: TeacherKind) => kind === "TEACHER" || kind === "BOTH";
/** 小幫手選單列誰：會上課的都可以（老師也會幫別人的課），不上課的不列。 */
export const canAssist = (kind: TeacherKind) => kind !== "NONE";

/** 成員加入時自動建的人員資料，身分照角色：小幫手 → 小幫手、老師 → 老師、管理員 → 不上課。 */
export function kindForRole(role: string): TeacherKind {
  if (role === "assistant") return "ASSISTANT";
  if (role === "teacher") return "TEACHER";
  return "NONE";
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
  kind: true,
  archivedAt: true,
  locations: { select: locationSummarySelect, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
} satisfies Prisma.TeacherSelect;

/** 選小幫手時的名單：不上課的拿掉，會當小幫手的（ASSISTANT／BOTH）排前面，其餘照原順序。 */
export function assistantsFirst<T extends { kind: TeacherKind }>(teachers: readonly T[]): T[] {
  const rank = (kind: TeacherKind) => (kind === "TEACHER" ? 1 : 0);
  return teachers.filter((t) => canAssist(t.kind)).sort((a, b) => rank(a.kind) - rank(b.kind));
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
