import { describe, expect, it } from "vitest";
import { rowsToRule, ruleToRows, hasVenuePack, validateRows } from "./ruleEditorModel";
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
