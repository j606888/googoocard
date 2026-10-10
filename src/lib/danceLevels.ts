import type { DanceStyleSummary } from "@/lib/danceStyles";

// Course levels shared by every dance type. A student's qualification stores
// the highest level they have completed; a lesson stores the level it teaches.
// Single place to rename or add a level.
export const DANCE_LEVELS = [
  { value: 1, label: "初階" },
  { value: 2, label: "中階" },
  { value: 3, label: "進階" },
] as const;

export type DanceLevel = (typeof DANCE_LEVELS)[number]["value"];

export const DEFAULT_DANCE_LEVEL: DanceLevel = 1;

export function isValidDanceLevel(value: unknown): value is DanceLevel {
  return DANCE_LEVELS.some((level) => level.value === value);
}

export function danceLevelLabel(level: number): string {
  return DANCE_LEVELS.find((l) => l.value === level)?.label ?? `Lv${level}`;
}

/**
 * The level a lesson teaches, as shown next to its style ("初階" / "中階" /
 * "進階") — every level, 初階 included, but only for a style that has levels;
 * null otherwise. The one rule for lesson lists and headers.
 */
export function lessonLevelLabel(
  style: Pick<DanceStyleSummary, "hasLevels"> | null | undefined,
  level: number
): string | null {
  return style?.hasLevels ? danceLevelLabel(level) : null;
}

// "Hustle" for 初階 or a style without levels, "Hustle 中階" above it.
export function practiceQualificationLabel(
  style: Pick<DanceStyleSummary, "name" | "hasLevels">,
  level: number
): string {
  return style.hasLevels && level > DEFAULT_DANCE_LEVEL
    ? `${style.name} ${danceLevelLabel(level)}`
    : style.name;
}

type StyleLabelSource = Pick<DanceStyleSummary, "name" | "hasLevels">;

/**
 * Why a practice card can't be bought in a lesson. The required style is the
 * card's own, falling back to the lesson's for legacy cards without one —
 * the same rule as `requiredDanceStyleFor`.
 */
export function practiceCardBlockedHint(
  card: { danceStyle?: StyleLabelSource | null },
  lesson: { danceStyle: StyleLabelSource | null; level: number }
): string {
  const style = card.danceStyle ?? lesson.danceStyle;
  return style
    ? `未具備 ${practiceQualificationLabel(style, lesson.level)} 複習資格`
    : "複習卡未設定舞種";
}
