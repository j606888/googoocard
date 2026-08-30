"use client";

import { useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import Menu from "@/components/Menu";
import { SORT_OPTIONS, StudentSort } from "./studentFilters";

/**
 * 排序選單。桌面版名單多了「剩餘堂數」「最近上課」兩把尺，
 * 選項數量已經超過原本的分段切換，所以改成下拉。
 */
const SortMenu = ({
  sort,
  onChange,
}: {
  sort: StudentSort;
  onChange: (sort: StudentSort) => void;
}) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const current = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-700 hover:border-primary-300 transition-colors cursor-pointer"
      >
        <ArrowUpDown className="w-4 h-4 text-neutral-400" />
        <span>排序</span>
        <span className="font-semibold text-neutral-900">{current.short}</span>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <Menu
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        className="w-56 rounded-2xl border border-black/5 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] z-50 flex flex-col"
      >
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left cursor-pointer hover:bg-neutral-50 ${
              option.value === sort ? "text-primary-700 font-semibold" : "text-neutral-700"
            }`}
          >
            <span className="flex-1">{option.label}</span>
            {option.value === sort && <Check className="w-4 h-4 text-primary-600" />}
          </button>
        ))}
      </Menu>
    </>
  );
};

export default SortMenu;
