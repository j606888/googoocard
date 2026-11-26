import { cn } from "@/lib/utils";
import type { CardOutcome } from "./cardStatus";
import { sessionDotRows } from "./sessionDotRows";

const SIZE = {
  sm: "size-[9px]",
  md: "size-3",
  lg: "size-4",
} as const;

type Dot = "left" | "low" | "used" | "transferred" | "unused";

const DOT_CLASS: Record<Dot, string> = {
  left: "bg-primary-600",
  low: "bg-warning-500",
  used: "bg-neutral-200",
  transferred: "border-2 border-dashed border-primary-700",
  unused: "border-[1.5px] border-neutral-300",
};

/**
 * 一堂一顆圓點。有效的卡：可用的在前（綠，快用完時橘），已上課的在後（淺灰）。
 * 已結束的卡：上過的在前（灰），剩下的依結束方式——轉讓出去是綠色虛線圈，
 * 轉換／停用時沒用到的是灰色空心圈。
 *
 * 排法由 `sessionDotRows()` 決定：8 堂以內一排，9–16 堂拆成等長的兩排，
 * 再多就改畫一條細進度條——不會自己折行。
 *
 * 堂數一定另外有文字。傳 `label` 時整組是一張有名字的圖（`role="img"`），
 * 沒傳就是純裝飾（`aria-hidden`）。
 */
const SessionDots = ({
  total,
  remaining,
  outcome = null,
  low = false,
  size = "md",
  align = "start",
  label,
  className,
}: {
  total: number;
  remaining: number;
  /** 已結束的卡怎麼結束的；null = 還有效。 */
  outcome?: CardOutcome | null;
  low?: boolean;
  size?: keyof typeof SIZE;
  /** 兩排不等長時（9 堂 = 5+4）靠哪一邊。 */
  align?: "start" | "end";
  /** 跟畫面上的文字同一句話，例：「剩 4 堂，共 12 堂」。 */
  label?: string;
  className?: string;
}) => {
  const used = Math.max(0, total - remaining);
  const rows = sessionDotRows(total);
  const a11y = label ? ({ role: "img", "aria-label": label } as const) : ({ "aria-hidden": true } as const);

  if (!rows) {
    const ratio = total > 0 ? Math.min(100, Math.round(((outcome ? used : remaining) / total) * 100)) : 0;
    return (
      <div {...a11y} className={cn("h-1.5 w-24 rounded-full bg-neutral-200 overflow-hidden", className)}>
        <div
          className={cn("h-full rounded-full", outcome ? "bg-neutral-400" : low ? "bg-warning-500" : "bg-primary-600")}
          style={{ width: `${ratio}%` }}
        />
      </div>
    );
  }

  const dots: Dot[] = outcome
    ? [
        ...Array<Dot>(used).fill("used"),
        ...Array<Dot>(Math.max(0, total - used)).fill(outcome === "transferred" ? "transferred" : "unused"),
      ]
    : [
        ...Array<Dot>(Math.min(total, Math.max(0, remaining))).fill(low ? "low" : "left"),
        ...Array<Dot>(used).fill("used"),
      ];

  const gap = size === "lg" ? "gap-1.5" : "gap-1";
  const starts = rows.map((_, rowIndex) => rows.slice(0, rowIndex).reduce((sum, count) => sum + count, 0));

  return (
    <div {...a11y} className={cn("flex flex-col", gap, align === "end" ? "items-end" : "items-start", className)}>
      {rows.map((count, rowIndex) => {
        const rowDots = dots.slice(starts[rowIndex], starts[rowIndex] + count);
        return (
          <div key={rowIndex} className={cn("flex flex-nowrap", gap)}>
            {rowDots.map((dot, index) => (
              <span
                key={index}
                className={cn(
                  "rounded-full box-border shrink-0",
                  SIZE[size],
                  DOT_CLASS[dot],
                  // 已結束的卡上過的堂深一點，跟空心圈分得開。
                  outcome && dot === "used" && "bg-neutral-300"
                )}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default SessionDots;
