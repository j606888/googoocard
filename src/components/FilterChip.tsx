"use client";

import type { ReactNode } from "react";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Shown after the label, e.g. how many students match. */
  count?: number;
  /** A red dot for chips that mean "needs attention" (需續約). */
  alert?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A toggleable filter pill — the quick filters above the roster, the filter
 * drawer's options, the card-name filter. Active is the dark primary so white
 * text keeps its contrast (primary-500 under white text did not).
 */
export default function FilterChip({
  active,
  onClick,
  children,
  count,
  alert = false,
  size = "md",
  className = "",
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors cursor-pointer ${
        size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
      } ${
        active
          ? "bg-primary-900 border-primary-900 text-white font-medium"
          : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-400"
      } ${className}`}
    >
      {alert && (
        <span
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : "bg-danger-500"}`}
        />
      )}
      {children}
      {count !== undefined && (
        <span className={`font-semibold ${active ? "text-white" : "text-neutral-500"}`}>{count}</span>
      )}
    </button>
  );
}
