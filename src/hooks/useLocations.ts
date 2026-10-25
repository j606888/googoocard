"use client";

import { useMemo } from "react";
import { useGetLocationsQuery, type Location } from "@/store/slices/locations";

const EMPTY: Location[] = [];

/**
 * The classroom's 分部 for teacher pages. `locations` is what pickers offer
 * (not archived, in sortOrder); `all` includes archived ones.
 */
export function useLocations() {
  const { data, isLoading } = useGetLocationsQuery();
  const all = data?.locations ?? EMPTY;
  const locations = useMemo(() => all.filter((l) => !l.archivedAt), [all]);
  return {
    all,
    locations,
    lineListed: data?.lineListed ?? false,
    isLoading,
  };
}
