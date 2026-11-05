import { describe, it, expect } from "vitest";
import { defaultScope, inBranch } from "./homeTodos";

describe("finance home todos", () => {
  const items = [
    { id: 1, locationId: 1 },
    { id: 2, locationId: 2 },
    { id: 3, locationId: null },
  ];

  it("keeps the branch's items plus the ones without a branch", () => {
    expect(inBranch(items, 1).map((i) => i.id)).toEqual([1, 3]);
    expect(inBranch(items, "all").map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("defaults to the branch I keep, otherwise the whole classroom", () => {
    expect(defaultScope(2, [{ id: 1 }, { id: 2 }])).toBe(2);
    expect(defaultScope(null, [{ id: 1 }])).toBe("all");
    expect(defaultScope(9, [{ id: 1 }])).toBe("all");
  });
});
