"use client";

import { useGetDanceStylesQuery, type DanceStyle } from "@/store/slices/danceStyles";

type DanceStylesView = {
  /** What pickers and filters offer — not archived, in `sortOrder`. */
  styles: DanceStyle[];
  /** Every style, archived included, so old lessons, cards and qualifications
   * still resolve their name and colour. Iterates in `sortOrder`. */
  byId: Map<number, DanceStyle>;
};

// Derived once per fetched list and shared by every caller: student rows each
// render badges, so a per-component useMemo would rebuild the map per row.
const views = new WeakMap<DanceStyle[], DanceStylesView>();
const EMPTY: DanceStylesView = { styles: [], byId: new Map() };

function viewOf(data: DanceStyle[] | undefined): DanceStylesView {
  if (!data) return EMPTY;
  let view = views.get(data);
  if (!view) {
    view = {
      styles: data.filter((style) => !style.archivedAt),
      byId: new Map(data.map((style) => [style.id, style])),
    };
    views.set(data, view);
  }
  return view;
}

/**
 * The classroom's dance styles for the teacher-facing app.
 *
 * Teacher pages only: the API needs a teacher session. LIFF and the QR board
 * read the `danceStyle` embedded in their own payloads instead.
 */
export function useDanceStyles() {
  const { data, isLoading } = useGetDanceStylesQuery();
  return { ...viewOf(data), isLoading };
}
