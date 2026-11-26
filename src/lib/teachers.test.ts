import { describe, it, expect } from "vitest";
import { danceStyleTones } from "./danceStyleColors";
import {
  firstFreeTeacherColor,
  TEACHER_COLOR_ORDER,
  TEACHER_COLOR_PRESETS,
  TEACHER_COLORS,
} from "./teachers";

/** `oklch(L C H)` → relative luminance (WCAG), through linear sRGB clipped to gamut. */
function luminance(css: string): number {
  const [L, C, H] = css.match(/[\d.]+/g)!.map(Number);
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const [r, g, bl] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => Math.min(1, Math.max(0, x)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

describe("teacher colours", () => {
  it("the avatar letter reads ≥4.5:1 on its tint for every stored colour, and for an unknown one", () => {
    for (const color of [...TEACHER_COLORS, "neutral"]) {
      const { chip } = danceStyleTones(color);
      const [light, dark] = [luminance(String(chip.backgroundColor)), luminance(String(chip.color))];
      expect((light + 0.05) / (dark + 0.05), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the picker offers no orange/red, and new teachers only ever get a picker colour", () => {
    expect(TEACHER_COLOR_PRESETS).not.toContain("orange");
    expect(TEACHER_COLOR_PRESETS).not.toContain("red");
    expect([...TEACHER_COLOR_ORDER].sort()).toEqual([...TEACHER_COLOR_PRESETS].sort());
    // …while teachers already stored on a dropped colour stay valid.
    expect(TEACHER_COLORS).toEqual(expect.arrayContaining(["orange", "red", "navy", "midnight"]));
  });

  it("firstFreeTeacherColor skips colours in use; an old orange teacher doesn't shift the order", () => {
    expect(firstFreeTeacherColor([])).toBe("blue");
    expect(firstFreeTeacherColor([{ color: "blue" }, { color: "orange" }])).toBe("purple");
    expect(firstFreeTeacherColor(TEACHER_COLOR_ORDER.map((color) => ({ color })))).toBe("blue");
  });
});
