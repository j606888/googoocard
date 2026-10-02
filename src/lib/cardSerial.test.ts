import { describe, it, expect } from "vitest";
import { formatCardSerial, parseCardSerial } from "./cardSerial";

describe("formatCardSerial", () => {
  it.each([
    [1, "#A0001"],
    [412, "#A0412"],
    [9999, "#A9999"],
    [10000, "#B0001"],
    [19998, "#B9999"],
    [19999, "#C0001"],
  ])("%i → %s", (n, expected) => {
    expect(formatCardSerial(n)).toBe(expected);
  });
});

describe("parseCardSerial", () => {
  it("round-trips every boundary", () => {
    for (const n of [1, 9999, 10000, 19998, 19999, 25 * 9999 + 9999]) {
      expect(parseCardSerial(formatCardSerial(n))).toBe(n);
    }
  });

  it("accepts lowercase, a missing #, and surrounding spaces", () => {
    expect(parseCardSerial("a0412")).toBe(412);
    expect(parseCardSerial("  #B0001 ")).toBe(10000);
  });

  it("rejects things that aren't serials", () => {
    expect(parseCardSerial("A0000")).toBeNull();
    expect(parseCardSerial("A412")).toBeNull();
    expect(parseCardSerial("A04120")).toBeNull();
    expect(parseCardSerial("小美")).toBeNull();
    expect(parseCardSerial("0412")).toBeNull();
  });
});
