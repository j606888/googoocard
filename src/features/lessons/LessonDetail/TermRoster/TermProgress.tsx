import type { TermAttendanceStatus } from "@/store/slices/lessons";
import { cn } from "@/lib/utils";
import { TERM_STATUS_META, termSegments } from "./termStatus";

/** 整期出缺勤的小格子（有來／請假／曠課／還沒上）。 */
const TermProgress = ({
  statuses,
  total,
  className,
}: {
  statuses: TermAttendanceStatus[];
  total: number;
  className?: string;
}) => {
  const segments = termSegments(statuses, total);
  return (
    <span
      className={cn("flex gap-1", className)}
      role="img"
      aria-label={segments.map((s, i) => `第 ${i + 1} 堂${TERM_STATUS_META[s].label}`).join("、")}
    >
      {segments.map((status, index) => (
        <span
          key={index}
          title={`第 ${index + 1} 堂：${TERM_STATUS_META[status].label}`}
          className={cn("h-1.5 min-w-2 flex-1 rounded-full", TERM_STATUS_META[status].className)}
        />
      ))}
    </span>
  );
};

export default TermProgress;
