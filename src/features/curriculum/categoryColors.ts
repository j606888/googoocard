import type { CSSProperties } from "react";
import type { DanceStyleColor } from "@/lib/danceStyles";

/**
 * 技能樹分類色，照 teach-what 的調色盤：`fill` 是實心底色（上面放深色圖示 `CATEGORY_ON_FILL`），
 * `ink` 是白底上的字色／線條色。key 沿用舞種的色票 key（`SkillCategory.color` 存的就是它）。
 */
export const CATEGORY_PALETTE: Record<DanceStyleColor, { fill: string; ink: string }> = {
  green: { fill: "#8FCB5B", ink: "#3F6B1C" },
  orange: { fill: "#FF9A55", ink: "#A6440A" },
  slate: { fill: "#A3AFBF", ink: "#46546A" },
  stone: { fill: "#F2B632", ink: "#8A5A0B" },
  purple: { fill: "#9C8EF7", ink: "#4F3FC4" },
  blue: { fill: "#5AB0F0", ink: "#1C5C8F" },
  pink: { fill: "#F57BAA", ink: "#B0245E" },
  teal: { fill: "#2EC4B2", ink: "#0B6B60" },
  red: { fill: "#F2786E", ink: "#A3302A" },
  indigo: { fill: "#8C9BEA", ink: "#3B4BA8" },
};

export const CATEGORY_ON_FILL = "#1A1726";
const FALLBACK = { fill: "#D4D4D4", ink: "#525252" };

export const categoryColor = (color: string | null | undefined) =>
  CATEGORY_PALETTE[color as DanceStyleColor] ?? FALLBACK;

/** `--sf`（fill）與 `--si`（ink）給 `bg-(--sf)`、`text-(--si)` 這類 class 用。 */
export const categoryVars = (color: string | null | undefined) => {
  const c = categoryColor(color);
  return { "--sf": c.fill, "--si": c.ink } as CSSProperties;
};
