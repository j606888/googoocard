import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/teacherStats";
import { currentMonthKey, monthLabel } from "./format";

const button =
  "w-10 h-10 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-700 hover:bg-neutral-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";

/** ‹ 2026 年 10 月 › — no further than this month: there's nothing to count yet. */
const MonthSwitcher = ({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) => {
  const isCurrent = month >= currentMonthKey();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="上個月"
        className={button}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="min-w-[7.5rem] text-center font-medium tabular-nums">{monthLabel(month)}</span>
      <button
        type="button"
        aria-label="下個月"
        className={button}
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default MonthSwitcher;
