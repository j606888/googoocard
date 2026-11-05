import { describe, it, expect } from "vitest";
import { monthWaterfall } from "./waterfall";
import type { WaterfallInput } from "./waterfall";

const T = 1; // 台南
const K = 2; // 高雄

// 週日課：在台南上（locationId = T），基金是高雄（fundLocationId = K）。
const input: WaterfallInput = {
  periods: [
    {
      lessonId: 10,
      lessonName: "週四期班",
      locationId: T,
      fundLocationId: T,
      income: { total: 1250 },
      allocations: [
        { payee: { type: "teacher", teacherId: 1 }, amount: 833.33, source: "line" },
        { payee: { type: "venue", venueId: 1 }, amount: 300, source: "line" },
        { payee: { type: "fund", locationId: T }, amount: 116.67, source: "rest" },
      ],
    },
    {
      lessonId: 20,
      lessonName: "週日 Body movement",
      locationId: T,
      fundLocationId: K,
      income: { total: 666.67 },
      allocations: [
        { payee: { type: "venue", venueId: 1 }, amount: 300, source: "line" },
        { payee: { type: "teacher", teacherId: 2 }, amount: 366.67, source: "rest" },
      ],
    },
    {
      lessonId: 30,
      lessonName: "高雄 Training",
      locationId: K,
      fundLocationId: K,
      income: { total: 1016.67 },
      allocations: [
        { payee: { type: "venue", venueId: 2 }, amount: 405, source: "line" },
        { payee: { type: "fund", locationId: K }, amount: 61.17, source: "line" },
        { payee: { type: "teacher", teacherId: 2 }, amount: 550.5, source: "rest" },
      ],
    },
    // 沒有分帳規則的課：收入算進來，但沒分給誰
    { lessonId: 40, lessonName: "新課", locationId: T, fundLocationId: T, income: { total: 500 }, allocations: null },
  ],
  byBranch: [
    // 台南：116.67 − 支出 500 + 過期收入 200
    { locationId: T, expenses: 500, fundChange: -183.33 },
    // 高雄：61.17 − 210 + 零頭 0.17
    { locationId: K, expenses: 210, fundChange: -148.66 },
  ],
};

describe("monthWaterfall", () => {
  it("groups lessons by the lesson's fund, not where it took place", () => {
    const k = monthWaterfall(input, K);
    expect(k.income).toBeCloseTo(666.67 + 1016.67, 2);
    expect(k.teachers).toBeCloseTo(366.67 + 550.5, 2);
    expect(k.venues).toBeCloseTo(705, 2);
    expect(k.fund).toBeCloseTo(61.17, 2);
    expect(k.lessons.map((l) => l.lessonId)).toEqual([30, 20]);
  });

  it("net change equals the branch's fund change; the gap shows as other", () => {
    const k = monthWaterfall(input, K);
    expect(k.expenses).toBe(210);
    expect(k.net).toBeCloseTo(-148.66, 2);
    expect(k.other).toBeCloseTo(0.17, 2);

    const t = monthWaterfall(input, T);
    expect(t.income).toBeCloseTo(1750, 2);
    expect(t.unallocated).toBe(500);
    expect(t.fund).toBeCloseTo(116.67, 2);
    expect(t.net).toBeCloseTo(-183.33, 2);
    expect(t.other).toBeCloseTo(200, 2);
  });

  it("all: every lesson, every branch", () => {
    const all = monthWaterfall(input, "all");
    expect(all.income).toBeCloseTo(1250 + 666.67 + 1016.67 + 500, 2);
    expect(all.lessons).toHaveLength(4);
    expect(all.net).toBeCloseTo(-183.33 - 148.66, 2);
    expect(all.expenses).toBe(710);
  });

  it("old snapshots without fundLocationId fall back to the lesson's location", () => {
    const old: WaterfallInput = {
      periods: input.periods.map((p) => ({ ...p, fundLocationId: undefined })),
      byBranch: input.byBranch,
    };
    expect(monthWaterfall(old, T).lessons.map((l) => l.lessonId)).toEqual([10, 20, 40]);
  });
});
