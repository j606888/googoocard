import { format } from "date-fns";
import type { RosterRow } from "@/domains/attendance/rosterInsights";

// Colours match StudentSection's old dated chips (bg-primary-500 / bg-danger-400
// / neutral outline) — the matrix transposed into one line per student, so the
// row reads left-to-right as that person's history.
const SEGMENT_STYLES = {
  attended: "bg-primary-500",
  absent: "bg-danger-400",
  not_started: "bg-white border border-dashed border-neutral-300",
} as const;

const SEGMENT_LABELS = {
  attended: "出席",
  absent: "缺席",
  not_started: "尚未點名",
} as const;

const SEGMENT_SIZE = "flex-1 min-w-[6px] max-w-[26px]";

const StreakStrip = ({ cells }: { cells: RosterRow["cells"] }) => (
  <div className="flex items-center gap-[3px] min-w-0">
    {cells.map((cell) => {
      const label = `${format(new Date(cell.startTime), "M/d")} ${SEGMENT_LABELS[cell.status]}`;
      return (
        <span
          key={cell.periodId}
          role="img"
          aria-label={label}
          title={label}
          className={`${SEGMENT_SIZE} h-4 rounded-sm ${SEGMENT_STYLES[cell.status]}`}
        />
      );
    })}
  </div>
);

/**
 * The dates above the strips — same segment sizing, so each date sits over its
 * column. Only drawn when a date still fits its segment.
 */
export const StreakDates = ({ cells }: { cells: RosterRow["cells"] }) => (
  <div className="flex items-end gap-[3px] min-w-0" aria-hidden="true">
    {cells.map((cell) => (
      <span
        key={cell.periodId}
        className={`${SEGMENT_SIZE} text-center text-[9px] leading-none text-neutral-500 tabular-nums overflow-hidden whitespace-nowrap`}
      >
        {format(new Date(cell.startTime), "M/d")}
      </span>
    ))}
  </div>
);

export default StreakStrip;
