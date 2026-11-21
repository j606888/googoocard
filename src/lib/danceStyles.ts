import type { Prisma } from "@prisma/client";

// Dance styles are classroom data (`DanceStyle`), not an enum. This module is
// the API shape and the palette keys; the Tailwind classes behind each palette
// key live with the UI.

/** Palette keys a style may use. Tailwind needs static class names, so the UI
 * maps each key to fixed classes rather than building them from the key. */
export const DANCE_STYLE_COLORS = [
  "green",
  "orange",
  "slate",
  "stone",
  "purple",
  "blue",
  "pink",
  "teal",
  "red",
  "indigo",
] as const;

export type DanceStyleColor = (typeof DANCE_STYLE_COLORS)[number];

/** Extra (cool) palette keys only teachers pick from — dance styles keep the ten above. */
export const EXTRA_PALETTE_COLORS = [
  "sky",
  "cyan",
  "emerald",
  "periwinkle",
  "violet",
  "navy",
  "plum",
  "midnight",
] as const;

/** Every key the palette knows (`danceStyleClasses()` maps them all). */
export const PALETTE_COLORS = [...DANCE_STYLE_COLORS, ...EXTRA_PALETTE_COLORS] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];

/**
 * The swatches the dance-style picker offers (2026-11-21). No orange/amber or red:
 * those read as 警告／錯誤. Styles already on `orange`/`red` keep them; anything
 * else comes from the picker's 自訂 swatch as a `#rrggbb` hex.
 */
export const DANCE_STYLE_PRESETS = [
  "green",
  "teal",
  "sky",
  "blue",
  "navy",
  "indigo",
  "purple",
  "plum",
  "pink",
  "slate",
  "stone",
] as const satisfies readonly PaletteColor[];

export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/;

/** A style's `color`: a palette key or a custom lowercase `#rrggbb`. */
export const isDanceStyleColor = (value: string) =>
  HEX_COLOR_RE.test(value) || (PALETTE_COLORS as readonly string[]).includes(value);

export const ABBREVIATION_MAX = 3;

/** "Salsa" → "Sa", "國標舞" → "國標": the first two characters of the name. */
export function defaultAbbreviation(name: string): string {
  return Array.from(name.trim()).slice(0, 2).join("");
}

/** The abbreviation to show: the style's own, else derived from its name. */
export function danceStyleAbbreviation(
  style: { name: string; abbreviation?: string | null } | null | undefined
): string {
  if (!style) return "";
  return style.abbreviation?.trim() || defaultAbbreviation(style.name);
}

/** What every lesson / card / student payload carries about its style. */
export type DanceStyleSummary = {
  id: number;
  name: string;
  /** Palette key or custom `#rrggbb` — render only through `danceStyleMeta()`. */
  color: string;
  abbreviation: string | null;
  hasLevels: boolean;
};

/** Prisma `select` for `DanceStyleSummary` — use it in includes instead of
 * `danceStyle: true`, so new DanceStyle columns never leak into responses. */
export const danceStyleSummarySelect = {
  id: true,
  name: true,
  color: true,
  abbreviation: true,
  hasLevels: true,
} satisfies Prisma.DanceStyleSelect;

export const danceStylePayloadSelect = {
  ...danceStyleSummarySelect,
  sortOrder: true,
  archivedAt: true,
} satisfies Prisma.DanceStyleSelect;
