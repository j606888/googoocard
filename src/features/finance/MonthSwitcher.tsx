"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthOf } from "@/domains/finance/months";
import { monthLabel, shiftMonth } from "./financeUi";

/** 上一月／下一月；不能超過這個月。 */
export default function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const current = monthOf(new Date());
  const btn =
    "size-11 grid place-items-center rounded-xl border border-neutral-300 bg-white text-neutral-700 cursor-pointer hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="上一個月" className={btn} onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <span className="min-w-28 text-center text-base font-semibold text-neutral-900 tabular-nums">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        aria-label="下一個月"
        className={btn}
        disabled={month >= current}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
