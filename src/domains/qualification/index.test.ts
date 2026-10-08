import { describe, it, expect } from "vitest";
import { DanceType } from "@prisma/client";
import {
  isQualified,
  requiredDanceTypeFor,
  canUseCard,
  canBuyCard,
  cardMatchesLesson,
  toDanceLevels,
} from "./index";

const generalCard = { isPracticeCard: false, danceType: null };
const bachataPracticeCard = { isPracticeCard: true, danceType: DanceType.BACHATA };
const salsaPracticeCard = { isPracticeCard: true, danceType: DanceType.SALSA };
// Practice card created before Card.danceType existed
const legacyPracticeCard = { isPracticeCard: true, danceType: null };

describe("isQualified", () => {
  it("returns true only when the dance type is present", () => {
    expect(isQualified({ BACHATA: 1 }, DanceType.BACHATA)).toBe(true);
    expect(isQualified({ BACHATA: 1 }, DanceType.SALSA)).toBe(false);
    expect(isQualified({}, DanceType.BACHATA)).toBe(false);
  });

  it("works for every dance type, including newer ones", () => {
    for (const type of Object.values(DanceType)) {
      expect(isQualified({ [type]: 1 }, type)).toBe(true);
    }
  });
});

describe("isQualified with levels", () => {
  it("requires the completed level to reach the required level", () => {
    expect(isQualified({ HUSTLE: 2 }, DanceType.HUSTLE, 1)).toBe(true);
    expect(isQualified({ HUSTLE: 2 }, DanceType.HUSTLE, 2)).toBe(true);
    expect(isQualified({ HUSTLE: 2 }, DanceType.HUSTLE, 3)).toBe(false);
  });

  it("defaults to level 1 (purchase eligibility)", () => {
    expect(isQualified({ HUSTLE: 1 }, DanceType.HUSTLE)).toBe(true);
    expect(isQualified({}, DanceType.HUSTLE)).toBe(false);
  });
});

describe("requiredDanceTypeFor", () => {
  it("prefers the card's own dance type", () => {
    expect(requiredDanceTypeFor(bachataPracticeCard, DanceType.SALSA)).toBe(
      DanceType.BACHATA
    );
  });

  it("falls back to the lesson dance type for legacy cards", () => {
    expect(requiredDanceTypeFor(legacyPracticeCard, DanceType.SALSA)).toBe(
      DanceType.SALSA
    );
  });

  it("returns null when neither is known", () => {
    expect(requiredDanceTypeFor(legacyPracticeCard)).toBe(null);
    expect(requiredDanceTypeFor(legacyPracticeCard, null)).toBe(null);
  });
});

describe("canUseCard", () => {
  it("always allows general cards", () => {
    expect(canUseCard(generalCard, {}, DanceType.BACHATA, 1)).toBe(true);
  });

  it("allows a practice card when qualified for its dance type", () => {
    expect(
      canUseCard(bachataPracticeCard, { BACHATA: 1 }, DanceType.BACHATA, 1)
    ).toBe(true);
  });

  it("blocks a practice card when not qualified", () => {
    expect(canUseCard(bachataPracticeCard, {}, DanceType.BACHATA, 1)).toBe(false);
    expect(
      canUseCard(bachataPracticeCard, { SALSA: 1 }, DanceType.BACHATA, 1)
    ).toBe(false);
  });

  it("blocks a practice card whose dance type mismatches the lesson", () => {
    // Even a Bachata-qualified student can't use a Bachata practice card in a Salsa lesson
    expect(
      canUseCard(bachataPracticeCard, { BACHATA: 1 }, DanceType.SALSA, 1)
    ).toBe(false);
  });

  it("legacy practice card falls back to lesson dance type", () => {
    expect(
      canUseCard(legacyPracticeCard, { SALSA: 1 }, DanceType.SALSA, 1)
    ).toBe(true);
    expect(
      canUseCard(legacyPracticeCard, { BACHATA: 1 }, DanceType.SALSA, 1)
    ).toBe(false);
  });
});

describe("canUseCard with lesson levels", () => {
  const hustlePracticeCard = { isPracticeCard: true, danceType: DanceType.HUSTLE };

  it("a student who completed 中階 may review 初階 and 中階, not 進階", () => {
    const levels = { HUSTLE: 2 };
    expect(canUseCard(hustlePracticeCard, levels, DanceType.HUSTLE, 1)).toBe(true);
    expect(canUseCard(hustlePracticeCard, levels, DanceType.HUSTLE, 2)).toBe(true);
    expect(canUseCard(hustlePracticeCard, levels, DanceType.HUSTLE, 3)).toBe(false);
  });

  it("a student who completed only 初階 may review only 初階", () => {
    const levels = { HUSTLE: 1 };
    expect(canUseCard(hustlePracticeCard, levels, DanceType.HUSTLE, 1)).toBe(true);
    expect(canUseCard(hustlePracticeCard, levels, DanceType.HUSTLE, 2)).toBe(false);
  });

  it("general cards ignore levels", () => {
    expect(canUseCard(generalCard, {}, DanceType.HUSTLE, 3)).toBe(true);
  });
});

describe("canBuyCard with lesson levels", () => {
  const hustlePracticeCard = { isPracticeCard: true, danceType: DanceType.HUSTLE };

  it("without a lesson, completing 初階 is enough", () => {
    expect(canBuyCard(hustlePracticeCard, { HUSTLE: 1 })).toEqual({ allowed: true });
  });

  it("inside a lesson, the lesson level must be reached", () => {
    expect(
      canBuyCard(hustlePracticeCard, { HUSTLE: 1 }, DanceType.HUSTLE, 2)
    ).toEqual({ allowed: false, reason: "NOT_QUALIFIED" });
    expect(
      canBuyCard(hustlePracticeCard, { HUSTLE: 2 }, DanceType.HUSTLE, 2)
    ).toEqual({ allowed: true });
  });
});

describe("toDanceLevels", () => {
  it("maps qualification rows to a level map", () => {
    expect(
      toDanceLevels([
        { danceType: DanceType.HUSTLE, level: 3 },
        { danceType: DanceType.BACHATA, level: 1 },
      ])
    ).toEqual({ HUSTLE: 3, BACHATA: 1 });
  });
});

describe("canBuyCard", () => {
  it("always allows general cards", () => {
    expect(canBuyCard(generalCard, {})).toEqual({ allowed: true });
    expect(canBuyCard(generalCard, {}, DanceType.BACHATA)).toEqual({
      allowed: true,
    });
  });

  it("allows a qualified student to buy a practice card without lesson context", () => {
    expect(canBuyCard(bachataPracticeCard, { BACHATA: 1 })).toEqual({
      allowed: true,
    });
  });

  it("blocks an unqualified student with NOT_QUALIFIED", () => {
    expect(canBuyCard(bachataPracticeCard, {})).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
    expect(canBuyCard(salsaPracticeCard, { BACHATA: 1 })).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
  });

  it("blocks a legacy practice card without lesson context as UNKNOWN_DANCE_TYPE", () => {
    expect(canBuyCard(legacyPracticeCard, { BACHATA: 1 })).toEqual({
      allowed: false,
      reason: "UNKNOWN_DANCE_TYPE",
    });
  });

  it("legacy practice card with lesson context validates against the lesson", () => {
    expect(
      canBuyCard(legacyPracticeCard, { BACHATA: 1 }, DanceType.BACHATA)
    ).toEqual({ allowed: true });
    expect(
      canBuyCard(legacyPracticeCard, {}, DanceType.BACHATA)
    ).toEqual({ allowed: false, reason: "NOT_QUALIFIED" });
  });

  it("card's own dance type wins over lesson context", () => {
    // Bachata practice card offered in a Salsa lesson: qualification is judged
    // by the card's type, not the lesson's
    expect(
      canBuyCard(bachataPracticeCard, { SALSA: 1 }, DanceType.SALSA)
    ).toEqual({ allowed: false, reason: "NOT_QUALIFIED" });
  });
});

describe("cardMatchesLesson", () => {
  it("general cards match any lesson", () => {
    expect(cardMatchesLesson(generalCard, DanceType.KIZOMBA)).toBe(true);
  });

  it("a general card carrying a danceType (category label) still matches any lesson", () => {
    const labelledGeneralCard = { isPracticeCard: false, danceType: DanceType.ZOUK };
    expect(cardMatchesLesson(labelledGeneralCard, DanceType.BACHATA)).toBe(true);
    expect(cardMatchesLesson(labelledGeneralCard, DanceType.ZOUK)).toBe(true);
  });

  it("practice cards must match the lesson dance type", () => {
    expect(cardMatchesLesson(bachataPracticeCard, DanceType.BACHATA)).toBe(true);
    expect(cardMatchesLesson(bachataPracticeCard, DanceType.SALSA)).toBe(false);
  });

  it("legacy practice cards (null danceType) match any lesson", () => {
    expect(cardMatchesLesson(legacyPracticeCard, DanceType.ZOUK)).toBe(true);
  });
});
