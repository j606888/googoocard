/**
 * 技能樹的純邏輯（docs/modules-plan.md 第 2 階段），從 teach-what `src/lib/skilltree.ts`
 * 搬過來、只留「列出想教的東西」用得到的部分。Server 與 client 共用。
 */
import { DANCE_STYLE_COLORS, type DanceStyleColor } from "@/lib/danceStyles";

export const SKILL_NAME_MAX = 60;
export const SKILL_FULL_NAME_MAX = 120;
export const SKILL_DESCRIPTION_MAX = 500;
export const CATEGORY_NAME_MAX = 30;
export const TIER_LABEL_MAX = 20;
export const MAX_TIERS = 10;

/** Icon keys a 分類 can pick; the UI maps each to a lucide icon (src/features/curriculum/categoryIcons.ts). */
export const SKILL_CATEGORY_ICONS = [
  "lightbulb",
  "footprints",
  "waves",
  "zap",
  "users",
  "target",
  "sparkles",
  "music",
  "heart",
  "star",
] as const;
export type SkillCategoryIcon = (typeof SKILL_CATEGORY_ICONS)[number];

export type SeedCategory = { name: string; color: DanceStyleColor; icon: SkillCategoryIcon };

/** 預設樹：teach-what 的 Bailamore 樹一開始的五個分類。 */
export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: "概念", color: "blue", icon: "lightbulb" },
  { name: "單人腳步", color: "teal", icon: "footprints" },
  { name: "Body Movement", color: "pink", icon: "waves" },
  { name: "Footwork", color: "orange", icon: "zap" },
  { name: "雙人招式", color: "purple", icon: "users" },
];
export const DEFAULT_TIERS = ["Lv1", "Lv2", "Lv3"];

const NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
/** Tiers are named by position: 一轉、二轉… */
export const tierName = (index: number) => `${NUM[index] ?? index + 1}轉`;

export type SkillChangeKind =
  | "add"
  | "place"
  | "rename"
  | "describe"
  | "move_tier"
  | "move_category"
  | "archive"
  | "restore";

export const CHANGE_WORD: Record<SkillChangeKind, string> = {
  add: "新增",
  place: "放進樹",
  rename: "改名",
  describe: "改說明",
  move_tier: "換等級",
  move_category: "換分類",
  archive: "從樹上移除",
  restore: "還原",
};

const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
export const sorted = <T extends { sortOrder: number }>(xs: readonly T[]) => [...xs].sort(bySort);

/** Moves item `id` one step (dir -1 / 1) and returns every id with its new sortOrder; null at either end. */
export function reorder<T extends { id: number; sortOrder: number }>(xs: readonly T[], id: number, dir: -1 | 1) {
  const list = sorted(xs);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return null;
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((x, k) => ({ id: x.id, sortOrder: k }));
}

/** How many names one paste into 待定區 may hold. */
export const MAX_DRAFT_PASTE = 100;

/**
 * Names pasted into 待定區, one per line: list markers ("-", "•", "1.", "2、") dropped, blanks and repeats left out
 * (case-insensitive), cut to 60 characters.
 */
export function draftNames(text: string) {
  const seen = new Set<string>();
  return text.split(/\r?\n/).flatMap((line) => {
    const name = line
      .replace(/^\s*(?:[-*•·・]|\d+\s*[.)、](?!\d))\s*/, "")
      .trim()
      .slice(0, SKILL_NAME_MAX)
      .trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return [];
    seen.add(key);
    return [name];
  });
}

/** Case-insensitive, whitespace-trimmed key for "the tree already has this name". */
export const nameKey = (name: string) => name.trim().toLowerCase();

/** A 分類 colour the tree doesn't use yet, so a new 分類 stands out. */
export const unusedColor = (categories: readonly { color: string }[]): DanceStyleColor =>
  DANCE_STYLE_COLORS.find((c) => !categories.some((x) => x.color === c)) ??
  DANCE_STYLE_COLORS[categories.length % DANCE_STYLE_COLORS.length];
