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

/** What every lesson / card / student payload carries about its style. */
export type DanceStyleSummary = {
  id: number;
  name: string;
  color: string;
  hasLevels: boolean;
};

/** A style as the dance-styles management API returns it. */
export type DanceStylePayload = DanceStyleSummary & {
  sortOrder: number;
  archivedAt: Date | null;
};

/** Prisma `select` for `DanceStyleSummary` — use it in includes instead of
 * `danceStyle: true`, so new DanceStyle columns never leak into responses. */
export const danceStyleSummarySelect = {
  id: true,
  name: true,
  color: true,
  hasLevels: true,
} satisfies Prisma.DanceStyleSelect;

export const danceStylePayloadSelect = {
  ...danceStyleSummarySelect,
  sortOrder: true,
  archivedAt: true,
} satisfies Prisma.DanceStyleSelect;
