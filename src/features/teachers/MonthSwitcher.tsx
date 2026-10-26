import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shiftMonth } from "@/lib/teacherStats";
import { currentMonthKey, monthLabel } from "./format";

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
      <Button
        variant="secondary"
        size="icon"
        aria-label="上個月"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-[7.5rem] text-center font-semibold text-neutral-900 tabular-nums">{monthLabel(month)}</span>
      <Button
        variant="secondary"
        size="icon"
        aria-label="下個月"
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
};

export default MonthSwitcher;
