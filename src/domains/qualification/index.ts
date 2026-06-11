import { DanceType } from "@prisma/client";

// Pure qualification rules shared by server (attendance, purchase validation)
// and client (card pickers). No prisma imports — keep this isomorphic.

export type QualifiableCard = {
  isPracticeCard: boolean;
  danceType: DanceType | null;
};

export type BuyDecision =
  | { allowed: true }
  | { allowed: false; reason: "NOT_QUALIFIED" | "UNKNOWN_DANCE_TYPE" };

export function isQualified(
  qualifications: DanceType[],
  danceType: DanceType
): boolean {
  return qualifications.includes(danceType);
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
export function canUseCard(
  card: QualifiableCard,
  qualifications: DanceType[],
  lessonDanceType: DanceType
): boolean {
  if (!card.isPracticeCard) {
    return true;
  }
  if (!cardMatchesLesson(card, lessonDanceType)) {
    return false;
  }
  const required = requiredDanceTypeFor(card, lessonDanceType);
  return required !== null && isQualified(qualifications, required);
}

// Purchase context — lesson is optional (student-detail page has none).
export function canBuyCard(
  card: QualifiableCard,
  qualifications: DanceType[],
  lessonDanceType?: DanceType | null
): BuyDecision {
  if (!card.isPracticeCard) {
    return { allowed: true };
  }
  const required = requiredDanceTypeFor(card, lessonDanceType);
  if (required === null) {
    return { allowed: false, reason: "UNKNOWN_DANCE_TYPE" };
  }
  if (!isQualified(qualifications, required)) {
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
