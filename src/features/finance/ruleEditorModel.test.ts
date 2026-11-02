import { describe, expect, it } from "vitest";
import { rowsToRule, ruleToRows, hasVenuePack, validateRows, describeRow } from "./ruleEditorModel";
import type { SplitRule } from "@/domains/finance/types";

// 台南：兩位老師各 1/3（收入）→ 場地固定 → 剩下的進公積金
const tainan: SplitRule = {
  lines: [
    { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: 1 } },
    { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: 2 } },
    { kind: "fixed", amount: 300, to: { type: "venue", venueId: 7 } },
  ],
  rest: { type: "fund", locationId: 5 },
  fundLocationId: 5,
};

// 高雄：場地次數包 → 助教 → 公積金 10%（剩下的）→ 剩下的平分
const kaohsiung: SplitRule = {
  lines: [
    { kind: "venuePack", venueId: 9 },
    { kind: "fixed", amount: 350, to: { type: "teacher", teacherId: 3 } },
    { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: 6 } },
  ],
  rest: {
    type: "teachers",
    shares: [
      { teacherId: 4, weight: 1 },
      { teacherId: 5, weight: 1 },
    ],
  },
  fundLocationId: 6,
};

describe("rule editor model", () => {
  it.each([
    ["tainan", tainan],
    ["kaohsiung", kaohsiung],
  ])("round-trips %s", (_name, rule) => {
    expect(rowsToRule(ruleToRows(rule))).toEqual(rule);
  });

  it("always ends with the rest row", () => {
    const rows = ruleToRows(kaohsiung);
    expect(rows[rows.length - 1].type).toBe("rest");
    expect(hasVenuePack(rows)).toBe(true);
    expect(validateRows(rows)).toBeNull();
  });
});

describe("describeRow", () => {
  const n = {
    payee: (p: any) => (p.type === "venue" ? (p.venueId === 1 ? "房東丁丁" : "24steps") : p.type === "teacher" ? "Sean" : "高雄公積金"),
    venue: (id: number) => (id === 1 ? "房東丁丁" : "24steps"),
    teacher: () => "Sean",
    location: () => "高雄",
  };
  it("reads like spec 4.3", () => {
    expect(describeRow({ type: "fixed", amount: 300, to: { type: "venue", venueId: 1 } }, n)).toBe("場地 $300 → 房東丁丁");
    expect(describeRow({ type: "fixed", amount: 405, to: { type: "venue", venueId: 2 } }, n)).toBe("場地 $405 → 24steps");
    expect(describeRow({ type: "percentIncome", pct: 100 / 3, to: { type: "teacher", teacherId: 1 } }, n)).toBe("收入 1/3 → Sean");
    expect(describeRow({ type: "percentRemaining", pct: 10, to: { type: "fund", locationId: 1 } }, n)).toBe("剩下的 10% → 高雄公積金");
    expect(describeRow({ type: "venuePack", venueId: 2 }, n)).toBe("場地次數包（24steps）");
    expect(describeRow({ type: "rest", rest: { type: "fund", locationId: 1 }, fundLocationId: 1 }, n)).toBe("剩下的 → 高雄公積金");
  });
});
