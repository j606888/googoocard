import { describe, it, expect } from "vitest";
import { danceStyleHex, danceStyleMeta, danceStyleTones } from "./danceStyleColors";
import { danceStyleAbbreviation, isDanceStyleColor } from "./danceStyles";

describe("dance style colours", () => {
  it("resolves palette keys and custom hex; unknown → gray", () => {
    expect(danceStyleHex("blue")).toBe("#3b82f6");
    expect(danceStyleHex("#a1b2c3")).toBe("#a1b2c3");
    expect(danceStyleHex("chartreuse")).toBe("#9ca3af");
    expect(danceStyleHex(null)).toBe("#9ca3af");
  });

  it("puts white on dark fills and dark ink on light ones", () => {
    expect(danceStyleTones("#1e293b").onFill.color).toBe("#fff");
    expect(danceStyleTones("#fef08a").onFill.color).toMatch(/^oklch\(0\.300 /);
  });

  it("validates colours", () => {
    expect(isDanceStyleColor("orange")).toBe(true);
    expect(isDanceStyleColor("#00ff7f")).toBe(true);
    expect(isDanceStyleColor("#00FF7F")).toBe(false); // the API lowercases first
    expect(isDanceStyleColor("teal; color:red")).toBe(false);
  });

  it("abbreviation: own value, else the name's first two characters", () => {
    expect(danceStyleAbbreviation({ name: "Salsa", abbreviation: "SA" })).toBe("SA");
    expect(danceStyleAbbreviation({ name: "Salsa", abbreviation: null })).toBe("Sa");
    expect(danceStyleAbbreviation({ name: "國標舞", abbreviation: " " })).toBe("國標");
    expect(danceStyleMeta(null).abbr).toBe("");
  });
});
