import { describe, expect, it } from "vitest";
import { draftNames, reorder, tierName, unusedColor } from "./skillTree";

// Sort orders are deliberately out of array order: everything must go by sortOrder.
const categories = [
  { id: 3, sortOrder: 2 },
  { id: 1, sortOrder: 0 },
  { id: 2, sortOrder: 1 },
];

describe("structure", () => {
  it("names tiers by position", () => {
    expect([0, 3, 4, 9].map(tierName)).toEqual(["一轉", "四轉", "五轉", "十轉"]);
  });
  it("moves an item one place and renumbers the rest", () => {
    expect(reorder(categories, 3, -1)).toEqual([
      { id: 1, sortOrder: 0 },
      { id: 3, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ]);
    expect(reorder(categories, 1, -1)).toBeNull();
    expect(reorder(categories, 3, 1)).toBeNull();
  });
});

describe("待定區", () => {
  it("a new 分類 gets a colour nobody uses", () => {
    expect(unusedColor([{ color: "green" }, { color: "orange" }])).toBe("slate");
    expect(unusedColor([])).toBe("green");
  });
  it("a paste becomes one name per line, without list markers, blanks or repeats", () => {
    expect(draftNames("- Basic\n\n• Side\r\n1. Hammerlock\n2、Cuddle\n  basic  \n3D body roll\n1.5 turn")).toEqual([
      "Basic",
      "Side",
      "Hammerlock",
      "Cuddle",
      "3D body roll",
      "1.5 turn",
    ]);
    expect(draftNames("x".repeat(80))[0]).toHaveLength(60);
    expect(draftNames("  \n - \n")).toEqual([]);
  });
});
