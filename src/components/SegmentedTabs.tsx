"use client";

import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Small trailing text, e.g. a count: 「出席 42」. */
  hint?: ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. 「學生資料分頁」. */
  ariaLabel: string;
  /**
   * `underline` — page sections (課卡／出席／動態): a tablist under a header.
   * `pill` — switching a view or filter inside a section (依日期／依課程).
   */
  variant?: "underline" | "pill";
  /** Stretch the options to fill the row (phone tab bars). */
  fill?: boolean;
  className?: string;
}

/**
 * The one segmented switch. Replaces the four hand-rolled copies the student
 * pages used to carry. `underline` renders real tabs (`role="tab"` +
 * `aria-selected`); `pill` is a button group with `aria-pressed`, because it
 * filters the same content rather than swapping panels.
 */
export default function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = "pill",
  fill = false,
  className = "",
}: SegmentedTabsProps<T>) {
  if (variant === "underline") {
    return (
      <div role="tablist" aria-label={ariaLabel} className={`flex gap-1 ${className}`}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={`${fill ? "flex-1" : ""} -mb-px min-h-11 px-3.5 text-sm border-b-2 transition-colors cursor-pointer ${
                active
                  ? "border-primary-600 text-primary-900 font-bold"
                  : "border-transparent text-neutral-500 font-medium hover:text-neutral-800"
              }`}
            >
              {option.label}
              {option.hint !== undefined && (
                <span className="ml-1 text-xs font-normal text-neutral-500">{option.hint}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`${fill ? "flex" : "inline-flex"} gap-1 bg-neutral-100 rounded-xl p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`${fill ? "flex-1" : ""} px-3.5 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
              active
                ? "bg-white text-neutral-900 font-semibold shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {option.label}
            {option.hint !== undefined && (
              <span className="ml-1 text-xs font-normal text-neutral-500">{option.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
