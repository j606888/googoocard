import { Prisma } from "@prisma/client";

/** 分部（台南／高雄…）。What lesson payloads carry about their location. */
export type LocationSummary = { id: number; name: string };

/** Prisma `select` for `LocationSummary` — use instead of `location: true`, so
 * new Location columns (address…) never leak into lesson responses. */
export const locationSummarySelect = {
  id: true,
  name: true,
} satisfies Prisma.LocationSelect;

export const locationPayloadSelect = {
  ...locationSummarySelect,
  address: true,
  sortOrder: true,
  archivedAt: true,
} satisfies Prisma.LocationSelect;
