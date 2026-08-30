"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook. Returns `false` on the server and on the first
 * client render, then updates after mount and on subsequent changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True on `md` and wider (≥ 768px), matching the app's desktop breakpoint. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

/** True on `lg` and wider (≥ 1024px) — the width the split student view needs. */
export function useIsWide(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
