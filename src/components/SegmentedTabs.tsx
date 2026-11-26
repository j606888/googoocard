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
              onClick={(event) => {
                // 滑鼠／手指點完就放掉焦點；否則之後按任何鍵，Chrome 會讓 :focus-visible 成立、冒出一圈框。
                // 鍵盤觸發的 click（detail 為 0）保留焦點框。
                if (event.detail !== 0) event.currentTarget.blur();
                onChange(option.value);
              }}
              className={`${fill ? "flex-1" : ""} -mb-px min-h-11 px-3.5 text-sm border-b-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 ${
                active
                  ? "border-primary-600 text-primary-900 font-bold"
                  : "border-transparent text-ink-3 font-medium hover:text-ink"
              }`}
            >
              {option.label}
              {option.hint !== undefined && (
                <span className="ml-1 text-xs font-normal tabular-nums text-ink-3">{option.hint}</span>
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
      className={`${fill ? "flex" : "inline-flex"} gap-1 bg-band rounded-xl p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={(event) => {
                // 滑鼠／手指點完就放掉焦點；否則之後按任何鍵，Chrome 會讓 :focus-visible 成立、冒出一圈框。
                // 鍵盤觸發的 click（detail 為 0）保留焦點框。
                if (event.detail !== 0) event.currentTarget.blur();
                onChange(option.value);
              }}
            className={`${fill ? "flex-1" : ""} px-3.5 py-1.5 text-sm rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 ${
              active
                ? "bg-white text-ink font-semibold shadow-sm"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            {option.label}
            {option.hint !== undefined && (
              <span className="ml-1 text-xs font-normal tabular-nums text-ink-3">{option.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
