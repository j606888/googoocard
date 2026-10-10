import { describe, it, expect } from "vitest";
import {
  cardMonthTotal,
  groupPurchasesByCard,
  purchasesToCsv,
  sessionMonthTotal,
} from "./incomeInsights";
import type { CardPurchase } from "./types";

const purchase = (overrides: Partial<CardPurchase>): CardPurchase => ({
  id: 1,
  date: "2026-10-02",
  studentId: 1,
  studentName: "小陶",
  cardName: "體驗課",
  finalPrice: 100,
  isPaid: true,
  ...overrides,
});

describe("month totals", () => {
  it("sums only the requested month's days", () => {
    const days = [
      { date: "2026-10-01", totalRevenue: 3067 },
      { date: "2026-09-27", totalRevenue: 3667 },
      { date: "2026-09-20", totalRevenue: 1000 },
    ];
    expect(sessionMonthTotal(days, "2026-09")).toBe(4667);
    expect(sessionMonthTotal(days, "2026-08")).toBe(0);
  });

  it("reads the card month total, 0 when missing", () => {
    const months = [{ month: "2026-09", totalRevenue: 12450, unpaidTotal: 0, count: 9 }];
    expect(cardMonthTotal(months, "2026-09")).toBe(12450);
    expect(cardMonthTotal(months, "2026-10")).toBe(0);
  });
});

describe("groupPurchasesByCard", () => {
  it("groups paid purchases by card name, largest revenue first", () => {
    const groups = groupPurchasesByCard([
      purchase({ id: 1, cardName: "體驗課", finalPrice: 300 }),
      purchase({ id: 2, cardName: "進階6堂", finalPrice: 2000 }),
      purchase({ id: 3, cardName: "體驗課", finalPrice: 100 }),
      purchase({ id: 4, cardName: "進階6堂", finalPrice: 2000, isPaid: false }),
    ]);
    expect(groups).toEqual([
      { cardName: "進階6堂", count: 1, revenue: 2000 },
      { cardName: "體驗課", count: 2, revenue: 400 },
    ]);
  });
});

describe("purchasesToCsv", () => {
  it("writes a BOM, a header and quotes cells that need it", () => {
    const csv = purchasesToCsv([
      purchase({ studentName: 'Tiffany "T", Adam朋友', isPaid: false }),
    ]);
    expect(csv.startsWith("﻿日期,學生,課卡,金額,付款\n")).toBe(true);
    expect(csv).toContain('2026-10-02,"Tiffany ""T"", Adam朋友",體驗課,100,未付款');
  });
});
