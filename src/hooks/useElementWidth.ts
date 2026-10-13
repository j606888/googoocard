"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The live width of an element (ResizeObserver). For layout decisions a
 * container makes about itself — e.g. the student detail showing its side
 * panel only when the pane is wide enough — where the viewport size class
 * isn't the right question.
 *
 * Returns a callback ref (not a RefObject) so it still attaches when the
 * element mounts on a later render — `useSizeClass()` is "compact" on the
 * first render, so the measured element often isn't there yet. 0 until measured.
 */
export function useElementWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useCallback((next: T | null) => setNode(next), []);

  useEffect(() => {
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, width];
}
