"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown } from "lucide-react";
import Menu from "@/components/Menu";

/** asc＝這個排序「預設的那個方向」（例如剩餘堂數少到多），desc＝反過來。 */
export type SortDirection = "asc" | "desc";

export interface SortOption<T extends string> {
  value: T;
  /** 選單裡的完整說明（沒有 directions 時帶方向） */
  label: string;
  /** 收合時顯示在按鈕上的短標籤 */
  short: string;
  /** 可以切正序／倒序時，兩個方向各自的說法：[asc, desc] */
  directions?: [string, string];
}

/** 正序／倒序的分段切換，排序選單和篩選抽屜共用。 */
export const SortDirectionToggle = ({
  labels,
  direction,
  onChange,
}: {
  labels: [string, string];
  direction: SortDirection;
  onChange: (direction: SortDirection) => void;
}) => (
  <div role="radiogroup" aria-label="排序方向" className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
    {(["asc", "desc"] as const).map((dir, i) => (
      <button
        key={dir}
        type="button"
        role="radio"
        aria-checked={direction === dir}
        onClick={() => onChange(dir)}
        className={`flex items-center justify-center gap-1 h-8 rounded-lg text-sm cursor-pointer transition-colors ${
          direction === dir
            ? "bg-white text-primary-900 font-semibold shadow-sm"
            : "text-neutral-600 hover:text-neutral-900"
        }`}
      >
        {dir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
        {labels[i]}
      </button>
    ))}
  </div>
);

/**
 * 排序下拉選單。列表的排序選項一多就塞不進分段切換，
 * 學生名單與課卡列表共用同一顆。給了 direction／onDirectionChange、
 * 且選項有 directions 時，選單底下多一排正序／倒序切換。
 */
const SortMenu = <T extends string>({
  sort,
  options,
  onChange,
  direction,
  onDirectionChange,
}: {
  sort: T;
  options: SortOption<T>[];
  onChange: (sort: T) => void;
  direction?: SortDirection;
  onDirectionChange?: (direction: SortDirection) => void;
}) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const current = options.find((option) => option.value === sort) ?? options[0];
  const directionLabels =
    direction && onDirectionChange ? current?.directions : undefined;

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 px-3 rounded-xl border-[1.5px] border-neutral-300 bg-white text-sm text-neutral-700 hover:border-primary-300 transition-colors cursor-pointer"
      >
        <ArrowUpDown className="w-4 h-4 text-neutral-500" />
        <span>排序</span>
        <span className="font-semibold text-neutral-900">{current?.short}</span>
        {directionLabels && (
          <span className="text-xs text-neutral-500">
            {directionLabels[direction === "desc" ? 1 : 0]}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <Menu
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        className="w-56 rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] z-50 flex flex-col"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer hover:bg-neutral-50 ${
              option.value === sort ? "text-primary-900 font-semibold" : "text-neutral-700"
            }`}
          >
            <span className="flex-1">{option.label}</span>
            {option.value === sort && <Check className="w-4 h-4 text-primary-700" />}
          </button>
        ))}
        {directionLabels && direction && onDirectionChange && (
          <div className="mt-1 border-t border-neutral-100 px-1 pt-2 pb-1">
            <SortDirectionToggle
              labels={directionLabels}
              direction={direction}
              onChange={(dir) => {
                onDirectionChange(dir);
                setOpen(false);
              }}
            />
          </div>
        )}
      </Menu>
    </>
  );
};

export default SortMenu;
