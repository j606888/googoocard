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

/**
 * 版型模式。全專案只有這一個邊界，定義在 `globals.css` 的 `@theme`
 * （`--breakpoint-lg`），CSS 端對應 `lg:` 變體。
 *
 * - `compact`  — 手機版型：BottomNav、一頁一步的 drill-down
 * - `expanded` — 桌面版型：側邊欄、分割檢視、單頁分區
 *
 * 之所以是字串而不是 boolean：哪天真的要加第三個 size class（平板直立），
 * 呼叫點是 `=== "expanded"` 而不是 `!isCompact`，加值不會全部要重寫。
 */
export type SizeClass = "compact" | "expanded";

const EXPANDED_BREAKPOINT_VAR = "--breakpoint-lg";
/** 只在 CSS 還沒掛上時用得到（SSR、以及 stylesheet 讀不到的極端情況）。 */
const EXPANDED_BREAKPOINT_FALLBACK = "1024px";

let cachedQuery: string | null = null;

/** 讀 `@theme` 的 breakpoint token 組出 media query；讀一次就快取。 */
function expandedMediaQuery(): string {
  if (cachedQuery) return cachedQuery;
  if (typeof window === "undefined") {
    return `(min-width: ${EXPANDED_BREAKPOINT_FALLBACK})`;
  }
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue(EXPANDED_BREAKPOINT_VAR)
    .trim();
  cachedQuery = `(min-width: ${token || EXPANDED_BREAKPOINT_FALLBACK})`;
  return cachedQuery;
}

/**
 * 目前的版型模式。SSR 與 client 首次 render 一律回 `"compact"`
 * （避免 hydration mismatch，代價寫在 docs/ui-responsive.md 的「已知取捨」）。
 */
export function useSizeClass(): SizeClass {
  return useMediaQuery(expandedMediaQuery()) ? "expanded" : "compact";
}
