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

const StreakStrip = ({ cells }: { cells: RosterRow["cells"] }) => (
  <div className="flex items-center gap-[3px] min-w-0">
    {cells.map((cell) => (
      <span
        key={cell.periodId}
        title={`${format(new Date(cell.startTime), "M/d")} ${SEGMENT_LABELS[cell.status]}`}
        className={`flex-1 min-w-[6px] max-w-[26px] h-4 rounded-sm ${SEGMENT_STYLES[cell.status]}`}
      />
    ))}
  </div>
);

export default StreakStrip;
