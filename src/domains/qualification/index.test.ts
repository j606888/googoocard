import { describe, it, expect } from "vitest";
import { DanceType } from "@prisma/client";
import {
  isQualified,
  requiredDanceTypeFor,
  canUseCard,
  canBuyCard,
  cardMatchesLesson,
} from "./index";

const generalCard = { isPracticeCard: false, danceType: null };
const bachataPracticeCard = { isPracticeCard: true, danceType: DanceType.BACHATA };
const salsaPracticeCard = { isPracticeCard: true, danceType: DanceType.SALSA };
// Practice card created before Card.danceType existed
const legacyPracticeCard = { isPracticeCard: true, danceType: null };

describe("isQualified", () => {
  it("returns true only when the dance type is in the list", () => {
    expect(isQualified([DanceType.BACHATA], DanceType.BACHATA)).toBe(true);
    expect(isQualified([DanceType.BACHATA], DanceType.SALSA)).toBe(false);
    expect(isQualified([], DanceType.BACHATA)).toBe(false);
  });

  it("works for every dance type, including newer ones", () => {
    for (const type of Object.values(DanceType)) {
      expect(isQualified([type], type)).toBe(true);
    }
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
    expect(canUseCard(generalCard, [], DanceType.BACHATA)).toBe(true);
  });

  it("allows a practice card when qualified for its dance type", () => {
    expect(
      canUseCard(bachataPracticeCard, [DanceType.BACHATA], DanceType.BACHATA)
    ).toBe(true);
  });

  it("blocks a practice card when not qualified", () => {
    expect(canUseCard(bachataPracticeCard, [], DanceType.BACHATA)).toBe(false);
    expect(
      canUseCard(bachataPracticeCard, [DanceType.SALSA], DanceType.BACHATA)
    ).toBe(false);
  });

  it("blocks a practice card whose dance type mismatches the lesson", () => {
    // Even a Bachata-qualified student can't use a Bachata practice card in a Salsa lesson
    expect(
      canUseCard(bachataPracticeCard, [DanceType.BACHATA], DanceType.SALSA)
    ).toBe(false);
  });

  it("legacy practice card falls back to lesson dance type", () => {
    expect(
      canUseCard(legacyPracticeCard, [DanceType.SALSA], DanceType.SALSA)
    ).toBe(true);
    expect(
      canUseCard(legacyPracticeCard, [DanceType.BACHATA], DanceType.SALSA)
    ).toBe(false);
  });
});

describe("canBuyCard", () => {
  it("always allows general cards", () => {
    expect(canBuyCard(generalCard, [])).toEqual({ allowed: true });
    expect(canBuyCard(generalCard, [], DanceType.BACHATA)).toEqual({
      allowed: true,
    });
  });

  it("allows a qualified student to buy a practice card without lesson context", () => {
    expect(canBuyCard(bachataPracticeCard, [DanceType.BACHATA])).toEqual({
      allowed: true,
    });
  });

  it("blocks an unqualified student with NOT_QUALIFIED", () => {
    expect(canBuyCard(bachataPracticeCard, [])).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
    expect(canBuyCard(salsaPracticeCard, [DanceType.BACHATA])).toEqual({
      allowed: false,
      reason: "NOT_QUALIFIED",
    });
  });

  it("blocks a legacy practice card without lesson context as UNKNOWN_DANCE_TYPE", () => {
    expect(canBuyCard(legacyPracticeCard, [DanceType.BACHATA])).toEqual({
      allowed: false,
      reason: "UNKNOWN_DANCE_TYPE",
    });
  });

  it("legacy practice card with lesson context validates against the lesson", () => {
    expect(
      canBuyCard(legacyPracticeCard, [DanceType.BACHATA], DanceType.BACHATA)
    ).toEqual({ allowed: true });
    expect(
      canBuyCard(legacyPracticeCard, [], DanceType.BACHATA)
    ).toEqual({ allowed: false, reason: "NOT_QUALIFIED" });
  });

  it("card's own dance type wins over lesson context", () => {
    // Bachata practice card offered in a Salsa lesson: qualification is judged
    // by the card's type, not the lesson's
    expect(
      canBuyCard(bachataPracticeCard, [DanceType.SALSA], DanceType.SALSA)
    ).toEqual({ allowed: false, reason: "NOT_QUALIFIED" });
  });
});

describe("cardMatchesLesson", () => {
  it("general cards match any lesson", () => {
    expect(cardMatchesLesson(generalCard, DanceType.KIZOMBA)).toBe(true);
  });

  it("practice cards must match the lesson dance type", () => {
    expect(cardMatchesLesson(bachataPracticeCard, DanceType.BACHATA)).toBe(true);
    expect(cardMatchesLesson(bachataPracticeCard, DanceType.SALSA)).toBe(false);
  });

  it("legacy practice cards (null danceType) match any lesson", () => {
    expect(cardMatchesLesson(legacyPracticeCard, DanceType.ZOUK)).toBe(true);
  });
});
