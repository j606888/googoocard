import { describe, it, expect } from "vitest";
import { DanceType } from "@prisma/client";
import { Card, CardHolder } from "@/store/slices/cards";
import {
  perSessionPrice,
  sortCards,
  splitByType,
  cardsSummary,
  isRunningOut,
  RENEWAL_SOON_SESSIONS,
  sortHolders,
} from "./cardInsights";

const card = (overrides: Partial<Card> & Pick<Card, "id" | "name">): Card => ({
  price: 1200,
  sessions: 6,
  isPracticeCard: false,
  danceType: null,
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

describe("sortCards", () => {
  const newest = card({ id: 1, name: "新卡", createdAt: "2026-06-01T00:00:00.000Z" });
  const rich = card({
    id: 2,
    name: "團體卡",
    createdAt: "2026-01-01T00:00:00.000Z",
    totalRevenue: 184800,
    activeHolders: 18,
    price: 8400,
    sessions: 12,
  });
  const cheap = card({
    id: 3,
    name: "體驗卡",
    createdAt: "2026-03-01T00:00:00.000Z",
    totalRevenue: 6000,
    activeHolders: 1,
    price: 500,
    sessions: 1,
  });
  const all = [rich, cheap, newest];

  it("defaults to newest first", () => {
    expect(sortCards(all, "newest").map((c) => c.id)).toEqual([1, 3, 2]);
  });

  it("sorts by revenue, holders and per-session price", () => {
    expect(sortCards(all, "revenue").map((c) => c.id)).toEqual([2, 3, 1]);
    expect(sortCards(all, "holders").map((c) => c.id)).toEqual([2, 3, 1]);
    // newest: 1200/6 = 200, rich: 700, cheap: 500
    expect(sortCards(all, "perSession").map((c) => c.id)).toEqual([1, 3, 2]);
  });

  it("breaks ties by name and never mutates the input", () => {
    const a = card({ id: 10, name: "B 卡" });
    const b = card({ id: 11, name: "A 卡" });
    const input = [a, b];
    expect(sortCards(input, "revenue").map((c) => c.id)).toEqual([11, 10]);
    expect(input.map((c) => c.id)).toEqual([10, 11]);
  });
});

describe("splitByType", () => {
  it("separates practice cards and keeps the incoming order within each group", () => {
    const general1 = card({ id: 1, name: "團體卡" });
    const practice = card({
      id: 2,
      name: "複習卡",
      isPracticeCard: true,
      danceType: DanceType.BACHATA,
    });
    const general2 = card({ id: 3, name: "私人課" });

    const { general, practice: practiceCards } = splitByType([general1, practice, general2]);
    expect(general.map((c) => c.id)).toEqual([1, 3]);
    expect(practiceCards.map((c) => c.id)).toEqual([2]);
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
