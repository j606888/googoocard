import { describe, it, expect } from "vitest";
import { Card, CardHolder } from "@/store/slices/cards";
import {
  perSessionPrice,
  cardKind,
  kindFlags,
  groupByDanceStyle,
  perSessionSavings,
  autoCardName,
  cardsSummary,
  isRunningOut,
  RENEWAL_SOON_SESSIONS,
  sortHolders,
} from "./cardInsights";

const card = (overrides: Partial<Card> & Pick<Card, "id" | "name">): Card => ({
  price: 1200,
  sessions: 6,
  isPracticeCard: false,
  isTrial: false,
  danceStyleId: null,
  expiredAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  purchasedCount: 0,
  activeHolders: 0,
  totalRevenue: 0,
  ...overrides,
});

const holder = (
  overrides: Partial<CardHolder> & Pick<CardHolder, "id" | "remainingSessions">
): CardHolder => ({
  serialNumber: overrides.id,
  studentId: overrides.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  totalSessions: 12,
  finalPrice: 8400,
  isPaid: true,
  paidAt: null,
  student: { id: overrides.id, name: `學生${overrides.id}`, avatarUrl: "" },
  ...overrides,
});

describe("perSessionPrice", () => {
  it("rounds to the nearest dollar", () => {
    expect(perSessionPrice({ price: 1800, sessions: 6 })).toBe(300);
    expect(perSessionPrice({ price: 1000, sessions: 3 })).toBe(333);
  });

  it("returns 0 rather than dividing by zero", () => {
    expect(perSessionPrice({ price: 1800, sessions: 0 })).toBe(0);
  });
});

describe("cardKind", () => {
  it("maps the two flags to one of three kinds, practice winning a legacy clash", () => {
    expect(cardKind({ isPracticeCard: false, isTrial: false })).toBe("general");
    expect(cardKind({ isPracticeCard: true, isTrial: false })).toBe("practice");
    expect(cardKind({ isPracticeCard: false, isTrial: true })).toBe("trial");
    expect(cardKind({ isPracticeCard: true, isTrial: true })).toBe("practice");
  });

  it("round-trips through kindFlags", () => {
    for (const kind of ["general", "practice", "trial"] as const) {
      expect(cardKind(kindFlags(kind))).toBe(kind);
    }
  });
});

describe("groupByDanceStyle", () => {
  const hustle8 = card({ id: 1, name: "Hustle 8", danceStyleId: 10, sessions: 8 });
  const hustle4 = card({ id: 2, name: "Hustle 4", danceStyleId: 10, sessions: 4 });
  const hustleTrial = card({ id: 3, name: "體驗", danceStyleId: 10, sessions: 1, isTrial: true });
  const hustlePractice = card({ id: 4, name: "複習", danceStyleId: 10, sessions: 4, isPracticeCard: true });
  const swing = card({ id: 5, name: "WCS 8", danceStyleId: 20, sessions: 8 });
  const any = card({ id: 6, name: "全舞種", danceStyleId: null, sessions: 10 });

  it("orders groups by the classroom's style order, unstyled cards last", () => {
    const groups = groupByDanceStyle([any, swing, hustle8], [20, 10]);
    expect(groups.map((g) => g.danceStyleId)).toEqual([20, 10, null]);
  });

  it("lists general → practice → trial, then by sessions, inside a group", () => {
    const [group] = groupByDanceStyle([hustleTrial, hustle8, hustlePractice, hustle4], [10]);
    expect(group.cards.map((c) => c.id)).toEqual([2, 1, 4, 3]);
  });

  it("puts a style missing from the order after the known ones but before unstyled", () => {
    const groups = groupByDanceStyle([any, swing, hustle8], [10]);
    expect(groups.map((g) => g.danceStyleId)).toEqual([10, 20, null]);
  });
});

describe("perSessionSavings", () => {
  const four = card({ id: 1, name: "4 堂", price: 2000, sessions: 4 }); // 500
  const eight = card({ id: 2, name: "8 堂", price: 3600, sessions: 8 }); // 450
  const practice = card({ id: 3, name: "複習", price: 1200, sessions: 4, isPracticeCard: true });
  const group = [four, eight, practice];

  it("compares a general card with the group's priciest general per-session price", () => {
    expect(perSessionSavings(eight, group)).toBe(50);
    expect(perSessionSavings(four, group)).toBe(0);
  });

  it("never shows savings on practice or trial cards", () => {
    expect(perSessionSavings(practice, group)).toBe(0);
  });
});

describe("autoCardName", () => {
  it("names each kind the way a teacher would", () => {
    expect(autoCardName({ styleName: "Hustle", kind: "general", sessions: 8 })).toBe("Hustle 8 堂");
    expect(autoCardName({ styleName: "Hustle", kind: "practice", sessions: 4 })).toBe("Hustle 複習 4 堂");
    expect(autoCardName({ styleName: "Hustle", kind: "trial", sessions: 1 })).toBe("Hustle 體驗課");
  });

  it("drops the style when the card isn't tied to one", () => {
    expect(autoCardName({ styleName: null, kind: "general", sessions: 10 })).toBe("10 堂");
    expect(autoCardName({ styleName: null, kind: "trial", sessions: 1 })).toBe("體驗課");
  });
});

describe("cardsSummary", () => {
  it("adds up kinds, active student cards and revenue", () => {
    const summary = cardsSummary([
      card({ id: 1, name: "A", activeHolders: 18, totalRevenue: 184800 }),
      card({ id: 2, name: "B", activeHolders: 5, totalRevenue: 12200 }),
      card({ id: 3, name: "C" }),
    ]);
    expect(summary).toEqual({ kinds: 3, activeStudentCards: 23, totalRevenue: 197000 });
  });

  it("is all zeroes for an empty classroom", () => {
    expect(cardsSummary([])).toEqual({ kinds: 0, activeStudentCards: 0, totalRevenue: 0 });
  });
});

describe("isRunningOut", () => {
  it("flags holders at or below the threshold", () => {
    expect(RENEWAL_SOON_SESSIONS).toBe(1);
    expect(isRunningOut({ remainingSessions: 0 })).toBe(true);
    expect(isRunningOut({ remainingSessions: 1 })).toBe(true);
    expect(isRunningOut({ remainingSessions: 2 })).toBe(false);
  });
});

describe("sortHolders", () => {
  const nearlyDone = holder({
    id: 1,
    remainingSessions: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  const alsoNearlyDone = holder({
    id: 2,
    remainingSessions: 1,
    createdAt: "2026-05-01T00:00:00.000Z",
  });
  const fresh = holder({
    id: 3,
    remainingSessions: 10,
    createdAt: "2026-08-01T00:00:00.000Z",
  });
  const all = [fresh, nearlyDone, alsoNearlyDone];

  it("puts the nearly-finished first, oldest purchase breaking the tie", () => {
    expect(sortHolders(all, "remaining").map((h) => h.id)).toEqual([2, 1, 3]);
  });

  it("sorts by purchase date in both directions", () => {
    expect(sortHolders(all, "newest").map((h) => h.id)).toEqual([3, 1, 2]);
    expect(sortHolders(all, "oldest").map((h) => h.id)).toEqual([2, 1, 3]);
  });

  it("never mutates the input", () => {
    const input = [fresh, nearlyDone];
    sortHolders(input, "remaining");
    expect(input.map((h) => h.id)).toEqual([3, 1]);
  });
});
