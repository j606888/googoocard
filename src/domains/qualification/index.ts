import { DanceType } from "@prisma/client";

// Pure qualification rules shared by server (attendance, purchase validation)
// and client (card pickers). No prisma imports — keep this isomorphic.

export type QualifiableCard = {
  isPracticeCard: boolean;
  danceType: DanceType | null;
};

// Highest completed level per dance type (1 = 初階, see src/lib/danceLevels.ts).
// A missing key = not qualified for that dance type at all.
export type DanceLevels = Partial<Record<DanceType, number>>;

export function toDanceLevels(
  rows: { danceType: DanceType; level: number }[]
): DanceLevels {
  const levels: DanceLevels = {};
  for (const row of rows) {
    levels[row.danceType] = row.level;
  }
  return levels;
}

export type BuyDecision =
  | { allowed: true }
  | { allowed: false; reason: "NOT_QUALIFIED" | "UNKNOWN_DANCE_TYPE" };

// Qualified when the student has completed at least `requiredLevel` of the
// dance type. Buying needs level 1; using a practice card needs the lesson's level.
export function isQualified(
  levels: DanceLevels,
  danceType: DanceType,
  requiredLevel = 1
): boolean {
  return (levels[danceType] ?? 0) >= requiredLevel;
}

// A practice card's required dance type: its own danceType when set,
// otherwise the lesson's (legacy cards created before Card.danceType existed).
export function requiredDanceTypeFor(
  card: QualifiableCard,
  lessonDanceType?: DanceType | null
): DanceType | null {
  return card.danceType ?? lessonDanceType ?? null;
}

// Usage context (attendance / consuming a session) — lesson is always known.
// A practice card reviews a lesson only up to the level the student completed:
// completed 中階 → may review 初階 and 中階 lessons, not 進階.
export function canUseCard(
  card: QualifiableCard,
  levels: DanceLevels,
  lessonDanceType: DanceType,
  lessonLevel: number
): boolean {
  if (!card.isPracticeCard) {
    return true;
  }
  if (!cardMatchesLesson(card, lessonDanceType)) {
    return false;
  }
  const required = requiredDanceTypeFor(card, lessonDanceType);
  return required !== null && isQualified(levels, required, lessonLevel);
}

// Purchase context — lesson is optional (student-detail page has none).
// Without a lesson, completing 初階 is enough. Buying inside a lesson is
// buying to review THAT lesson, so the lesson's level must be reached too.
export function canBuyCard(
  card: QualifiableCard,
  levels: DanceLevels,
  lessonDanceType?: DanceType | null,
  lessonLevel = 1
): BuyDecision {
  if (!card.isPracticeCard) {
    return { allowed: true };
  }
  const required = requiredDanceTypeFor(card, lessonDanceType);
  if (required === null) {
    return { allowed: false, reason: "UNKNOWN_DANCE_TYPE" };
  }
  if (!isQualified(levels, required, lessonLevel)) {
    return { allowed: false, reason: "NOT_QUALIFIED" };
  }
  return { allowed: true };
}

// Whether a practice card may be attached to (or used in) a lesson of the
// given dance type. Null danceType = legacy generic practice card, allowed.
export function cardMatchesLesson(
  card: QualifiableCard,
  lessonDanceType: DanceType
): boolean {
  if (!card.isPracticeCard) {
    return true;
  }
  return card.danceType === null || card.danceType === lessonDanceType;
}
