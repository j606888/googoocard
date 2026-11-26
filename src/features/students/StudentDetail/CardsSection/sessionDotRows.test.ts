import { describe, expect, it } from "vitest";
import { sessionDotRows } from "./sessionDotRows";

describe("sessionDotRows", () => {
  it("8 堂以內排一排", () => {
    expect(sessionDotRows(1)).toEqual([1]);
    expect(sessionDotRows(6)).toEqual([6]);
    expect(sessionDotRows(8)).toEqual([8]);
  });

  it("9–16 堂拆成兩排，盡量等長", () => {
    expect(sessionDotRows(12)).toEqual([6, 6]);
    expect(sessionDotRows(10)).toEqual([5, 5]);
    expect(sessionDotRows(9)).toEqual([5, 4]);
    expect(sessionDotRows(16)).toEqual([8, 8]);
  });

  it("太多堂、0 堂或不是整數就不畫圓點", () => {
    expect(sessionDotRows(17)).toBeNull();
    expect(sessionDotRows(24)).toBeNull();
    expect(sessionDotRows(0)).toBeNull();
    expect(sessionDotRows(-1)).toBeNull();
    expect(sessionDotRows(7.5)).toBeNull();
  });
});
