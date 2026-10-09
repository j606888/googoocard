// Pure qualification rules shared by server (attendance, purchase validation)
// and client (card pickers). No prisma imports — keep this isomorphic.
//
// Dance styles are classroom data (`DanceStyle`), referenced by id. A style
// with `hasLevels` off has no 初階/中階/進階 — every lesson of it counts as
// level 1, so "qualified" simply means "has completed it".

export type QualifiableCard = {
  isPracticeCard: boolean;
  danceStyleId: number | null;
};

// The lesson a card is bought or used in. `danceStyle.hasLevels` decides
// whether `level` means anything. The style is nullable only until the
// contract migration makes Lesson.danceStyleId NOT NULL: a lesson without one
// matches no practice card, so practice cards fail closed there.
export type QualifyingLesson = {
  danceStyleId: number | null;
  level: number;
  danceStyle: { hasLevels: boolean } | null;
};

// Highest completed level per dance style id (1 = 初階, see src/lib/danceLevels.ts).
// A missing key = not qualified for that dance style at all.
export type DanceLevels = Record<number, number>;

export function toDanceLevels(
  rows: { danceStyleId: number | null; level: number }[]
): DanceLevels {
  const levels: DanceLevels = {};
  for (const row of rows) {
    // Null only on legacy rows the backfill hasn't reached yet.
    if (row.danceStyleId !== null) levels[row.danceStyleId] = row.level;
  }
  return levels;
}

export type BuyDecision =
  | { allowed: true }
  | { allowed: false; reason: "NOT_QUALIFIED" | "UNKNOWN_DANCE_TYPE" };

// The level a lesson asks of a practice card user: its own level when the
// style is levelled, otherwise 1.
export function requiredLevelFor(lesson: QualifyingLesson): number {
  return lesson.danceStyle?.hasLevels ? lesson.level : 1;
}

// Qualified when the student has completed at least `requiredLevel` of the
// dance style. Buying needs level 1; using a practice card needs the lesson's level.
export function isQualified(
  levels: DanceLevels,
  danceStyleId: number,
  requiredLevel = 1
): boolean {
  return (levels[danceStyleId] ?? 0) >= requiredLevel;
}

// A practice card's required dance style: its own when set, otherwise the
// lesson's (legacy cards created before Card.danceType existed).
export function requiredDanceStyleFor(
  card: QualifiableCard,
  lesson?: { danceStyleId: number | null } | null
): number | null {
  return card.danceStyleId ?? lesson?.danceStyleId ?? null;
}

// Usage context (attendance / consuming a session) — lesson is always known.
// A practice card reviews a lesson only up to the level the student completed:
// completed 中階 → may review 初階 and 中階 lessons, not 進階.
export function canUseCard(
  card: QualifiableCard,
  levels: DanceLevels,
  lesson: QualifyingLesson
): boolean {
  if (!card.isPracticeCard) {
    return true;
  }
  if (!cardMatchesLesson(card, lesson.danceStyleId)) {
    return false;
  }
  const required = requiredDanceStyleFor(card, lesson);
  return required !== null && isQualified(levels, required, requiredLevelFor(lesson));
}

// Purchase context — lesson is optional (student-detail page has none).
// Without a lesson, completing 初階 is enough. Buying inside a lesson is
// buying to review THAT lesson, so the lesson's level must be reached too.
export function canBuyCard(
  card: QualifiableCard,
  levels: DanceLevels,
  lesson?: QualifyingLesson | null
): BuyDecision {
  if (!card.isPracticeCard) {
    return { allowed: true };
  }
  const required = requiredDanceStyleFor(card, lesson);
  if (required === null) {
    return { allowed: false, reason: "UNKNOWN_DANCE_TYPE" };
  }
  if (!isQualified(levels, required, lesson ? requiredLevelFor(lesson) : 1)) {
    return { allowed: false, reason: "NOT_QUALIFIED" };
  }
  return { allowed: true };
}

// Whether a practice card may be attached to (or used in) a lesson of the
// given dance style. Null danceStyleId = legacy generic practice card, allowed.
export function cardMatchesLesson(
  card: QualifiableCard,
  lessonDanceStyleId: number | null
): boolean {
  if (!card.isPracticeCard) {
    return true;
  }
  return card.danceStyleId === null || card.danceStyleId === lessonDanceStyleId;
}
