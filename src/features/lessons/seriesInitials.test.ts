import { describe, it, expect } from "vitest";
import { seriesInitials } from "./seriesInitials";

describe("seriesInitials", () => {
  it.each([
    ["Bachata Lv1", "Ba"],
    ["Bachata LV1", "Ba"],
    ["Bachata Level 1", "Ba"],
    ["2. Bachata Lv1", "Ba"],
    ["Bachata training", "Bt"],
    ["Body movement", "Bm"],
    ["Salsa", "Sa"],
    ["salsa", "Sa"],
    ["K", "K"],
    ["街舞入門", "街"],
    ["Zouk 進階", "Zo"],
    ["Lv1", "Lv"],
    ["  ", "?"],
  ])("%s → %s", (name, expected) => {
    expect(seriesInitials(name)).toBe(expected);
  });
});
