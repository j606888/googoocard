import { describe, it, expect } from "vitest";
import {
  isQualified,
  requiredDanceStyleFor,
  requiredLevelFor,
  canUseCard,
  canBuyCard,
  cardMatchesLesson,
  toDanceLevels,
  type QualifyingLesson,
} from "./index";

// Dance style ids, as a classroom would have them.
const BACHATA = 11;
const SALSA = 12;
const ZOUK = 13;
const HUSTLE = 14; // the only levelled style

const lesson = (danceStyleId: number, level = 1): QualifyingLesson => ({
  danceStyleId,
  level,
  danceStyle: { hasLevels: danceStyleId === HUSTLE },
});

const generalCard = { isPracticeCard: false, danceStyleId: null };
const bachataPracticeCard = { isPracticeCard: true, danceStyleId: BACHATA };
const salsaPracticeCard = { isPracticeCard: true, danceStyleId: SALSA };
const hustlePracticeCard = { isPracticeCard: true, danceStyleId: HUSTLE };
// Practice card created before Card.danceType existed
const legacyPracticeCard = { isPracticeCard: true, danceStyleId: null };

describe("isQualified", () => {
  it("returns true only when the dance style is present", () => {
    expect(isQualified({ [BACHATA]: 1 }, BACHATA)).toBe(true);
    expect(isQualified({ [BACHATA]: 1 }, SALSA)).toBe(false);
    expect(isQualified({}, BACHATA)).toBe(false);
  });

  it("requires the completed level to reach the required level", () => {
    expect(isQualified({ [HUSTLE]: 2 }, HUSTLE, 1)).toBe(true);
    expect(isQualified({ [HUSTLE]: 2 }, HUSTLE, 2)).toBe(true);
    expect(isQualified({ [HUSTLE]: 2 }, HUSTLE, 3)).toBe(false);
  });

  it("defaults to level 1 (purchase eligibility)", () => {
    expect(isQualified({ [HUSTLE]: 1 }, HUSTLE)).toBe(true);
    expect(isQualified({}, HUSTLE)).toBe(false);
  });
});

describe("requiredLevelFor", () => {
  it("is the lesson level for a levelled style", () => {
    expect(requiredLevelFor(lesson(HUSTLE, 3))).toBe(3);
  });

  it("is always 1 for a style without levels, whatever the lesson says", () => {
    expect(requiredLevelFor(lesson(BACHATA, 3))).toBe(1);
  });
});

describe("requiredDanceStyleFor", () => {
  it("prefers the card's own dance style", () => {
    expect(requiredDanceStyleFor(bachataPracticeCard, lesson(SALSA))).toBe(BACHATA);
  });

  it("falls back to the lesson dance style for legacy cards", () => {
    expect(requiredDanceStyleFor(legacyPracticeCard, lesson(SALSA))).toBe(SALSA);
  });

  it("returns null when neither is known", () => {
    expect(requiredDanceStyleFor(legacyPracticeCard)).toBe(null);
    expect(requiredDanceStyleFor(legacyPracticeCard, null)).toBe(null);
  });
});

describe("canUseCard", () => {
  it("always allows general cards", () => {
    expect(canUseCard(generalCard, {}, lesson(BACHATA))).toBe(true);
    expect(canUseCard(generalCard, {}, lesson(HUSTLE, 3))).toBe(true);
  });

  it("allows a practice card when qualified for its dance style", () => {
    expect(canUseCard(bachataPracticeCard, { [BACHATA]: 1 }, lesson(BACHATA))).toBe(true);
  });

  it("blocks a practice card when not qualified", () => {
    expect(canUseCard(bachataPracticeCard, {}, lesson(BACHATA))).toBe(false);
    expect(canUseCard(bachataPracticeCard, { [SALSA]: 1 }, lesson(BACHATA))).toBe(false);
  });

  it("blocks a practice card whose dance style mismatches the lesson", () => {
    // Even a Bachata-qualified student can't use a Bachata practice card in a Salsa lesson
    expect(canUseCard(bachataPracticeCard, { [BACHATA]: 1 }, lesson(SALSA))).toBe(false);
  });

  it("legacy practice card falls back to lesson dance style", () => {
    expect(canUseCard(legacyPracticeCard, { [SALSA]: 1 }, lesson(SALSA))).toBe(true);
    expect(canUseCard(legacyPracticeCard, { [BACHATA]: 1 }, lesson(SALSA))).toBe(false);
  });
});

describe("canUseCard with lesson levels", () => {
  it("a student who completed 中階 may review 初階 and 中階, not 進階", () => {
    const levels = { [HUSTLE]: 2 };
    expect(canUseCard(hustlePracticeCard, levels, lesson(HUSTLE, 1))).toBe(true);
    expect(canUseCard(hustlePracticeCard, levels, lesson(HUSTLE, 2))).toBe(true);
    expect(canUseCard(hustlePracticeCard, levels, lesson(HUSTLE, 3))).toBe(false);
  });

  it("a student who completed only 初階 may review only 初階", () => {
    const levels = { [HUSTLE]: 1 };
    expect(canUseCard(hustlePracticeCard, levels, lesson(HUSTLE, 1))).toBe(true);
    expect(canUseCard(hustlePracticeCard, levels, lesson(HUSTLE, 2))).toBe(false);
  });

  it("ignores a leftover lesson level when the style has levels switched off", () => {
    expect(canUseCard(bachataPracticeCard, { [BACHATA]: 1 }, lesson(BACHATA, 3))).toBe(true);
  });
});

describe("canBuyCard", () => {
  it("always allows general cards", () => {
    expect(canBuyCard(generalCard, {})).toEqual({ allowed: true });
    expect(canBuyCard(generalCard, {}, lesson(BACHATA))).toEqual({ allowed: true });
  });

  it("allows a qualified student to buy a practice card without lesson context", () => {
    expect(canBuyCard(bachataPracticeCard, { [BACHATA]: 1 })).toEqual({ allowed: true });
  });

  it("blocks an unqualified student with NOT_QUALIFIED", () => {
    expect(canBuyCard(bachataPracticeCard, {})).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
    expect(canBuyCard(salsaPracticeCard, { [BACHATA]: 1 })).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
  });

  it("blocks a legacy practice card without lesson context as UNKNOWN_DANCE_TYPE", () => {
    expect(canBuyCard(legacyPracticeCard, { [BACHATA]: 1 })).toEqual({
      allowed: false,
      reason: "UNKNOWN_DANCE_TYPE",
    });
  });

  it("legacy practice card with lesson context validates against the lesson", () => {
    expect(canBuyCard(legacyPracticeCard, { [BACHATA]: 1 }, lesson(BACHATA))).toEqual({
      allowed: true,
    });
    expect(canBuyCard(legacyPracticeCard, {}, lesson(BACHATA))).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
  });

  it("card's own dance style wins over lesson context", () => {
    // Bachata practice card offered in a Salsa lesson: qualification is judged
    // by the card's style, not the lesson's
    expect(canBuyCard(bachataPracticeCard, { [SALSA]: 1 }, lesson(SALSA))).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
  });
});

describe("canBuyCard with lesson levels", () => {
  it("without a lesson, completing 初階 is enough", () => {
    expect(canBuyCard(hustlePracticeCard, { [HUSTLE]: 1 })).toEqual({ allowed: true });
  });

  it("inside a lesson, the lesson level must be reached", () => {
    expect(canBuyCard(hustlePracticeCard, { [HUSTLE]: 1 }, lesson(HUSTLE, 2))).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
    expect(canBuyCard(hustlePracticeCard, { [HUSTLE]: 2 }, lesson(HUSTLE, 2))).toEqual({
      allowed: true,
    });
  });

  it("a style without levels needs only 初階, even in a lesson marked higher", () => {
    expect(canBuyCard(bachataPracticeCard, { [BACHATA]: 1 }, lesson(BACHATA, 2))).toEqual({
      allowed: true,
    });
  });
});

describe("toDanceLevels", () => {
  it("maps qualification rows to a level map", () => {
    expect(
      toDanceLevels([
        { danceStyleId: HUSTLE, level: 3 },
        { danceStyleId: BACHATA, level: 1 },
      ])
    ).toEqual({ [HUSTLE]: 3, [BACHATA]: 1 });
  });

  it("skips rows not yet backfilled", () => {
    expect(toDanceLevels([{ danceStyleId: null, level: 2 }])).toEqual({});
  });
});

describe("cardMatchesLesson", () => {
  it("general cards match any lesson", () => {
    expect(cardMatchesLesson(generalCard, ZOUK)).toBe(true);
  });

  it("a general card carrying a dance style (category label) still matches any lesson", () => {
    const labelledGeneralCard = { isPracticeCard: false, danceStyleId: ZOUK };
    expect(cardMatchesLesson(labelledGeneralCard, BACHATA)).toBe(true);
    expect(cardMatchesLesson(labelledGeneralCard, ZOUK)).toBe(true);
  });

  it("practice cards must match the lesson dance style", () => {
    expect(cardMatchesLesson(bachataPracticeCard, BACHATA)).toBe(true);
    expect(cardMatchesLesson(bachataPracticeCard, SALSA)).toBe(false);
  });

  it("legacy practice cards (null dance style) match any lesson", () => {
    expect(cardMatchesLesson(legacyPracticeCard, ZOUK)).toBe(true);
  });
});

describe("lesson without a dance style (pre-contract legacy row)", () => {
  const unstyled: QualifyingLesson = { danceStyleId: null, level: 1, danceStyle: null };

  it("fails closed for practice cards and stays open for general cards", () => {
    expect(canUseCard(bachataPracticeCard, { [BACHATA]: 1 }, unstyled)).toBe(false);
    expect(canUseCard(legacyPracticeCard, { [BACHATA]: 1 }, unstyled)).toBe(false);
    expect(canUseCard(generalCard, {}, unstyled)).toBe(true);
    expect(canBuyCard(legacyPracticeCard, { [BACHATA]: 1 }, unstyled)).toEqual({
      allowed: false,
      reason: "UNKNOWN_DANCE_TYPE",
    });
  });
});
