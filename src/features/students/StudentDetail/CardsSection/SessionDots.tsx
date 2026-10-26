import { cn } from "@/lib/utils";
import type { CardOutcome } from "./cardStatus";

/** 超過這麼多堂就畫不下圓點了，改用進度條。 */
const MAX_DOTS = 12;

const SIZE = {
  sm: "size-[9px]",
  md: "size-3",
  lg: "size-[18px]",
} as const;

type Dot = "left" | "low" | "used" | "transferred" | "unused";

const DOT_CLASS: Record<Dot, string> = {
  left: "bg-primary-600",
  low: "bg-danger-600",
  used: "bg-neutral-200",
  transferred: "border-2 border-dashed border-primary-700",
  unused: "border-[1.5px] border-neutral-300",
};

/**
 * 一堂一顆圓點（設計稿「票根」）。有效的卡：可用的在前（綠，快用完時紅），
 * 已上課的在後（灰）。已結束的卡：上過的在前（灰），剩下的依結束方式——
 * 轉讓出去是綠色虛線圈，轉換／停用時沒用到的是灰色空心圈。
 * 純裝飾：堂數一定另外有文字，所以整組 aria-hidden。
 */
const SessionDots = ({
  total,
  remaining,
  outcome = null,
  low = false,
  size = "md",
  className,
}: {
  total: number;
  remaining: number;
  /** 已結束的卡怎麼結束的；null = 還有效。 */
  outcome?: CardOutcome | null;
  low?: boolean;
  size?: keyof typeof SIZE;
  className?: string;
}) => {
  const used = Math.max(0, total - remaining);

  if (total > MAX_DOTS || total <= 0) {
    const ratio = total > 0 ? Math.min(100, Math.round(((outcome ? used : remaining) / total) * 100)) : 0;
    return (
      <div aria-hidden className={cn("h-1.5 w-24 rounded-full bg-neutral-100 overflow-hidden", className)}>
        <div
          className={cn("h-full rounded-full", outcome ? "bg-neutral-300" : low ? "bg-danger-600" : "bg-primary-600")}
          style={{ width: `${ratio}%` }}
        />
      </div>
    );
  }

  const dots: Dot[] = outcome
    ? [
        ...Array<Dot>(used).fill("used"),
        ...Array<Dot>(remaining).fill(outcome === "transferred" ? "transferred" : "unused"),
      ]
    : [...Array<Dot>(remaining).fill(low ? "low" : "left"), ...Array<Dot>(used).fill("used")];

  return (
    <div aria-hidden className={cn("flex flex-wrap", size === "lg" ? "gap-1.5" : "gap-1", className)}>
      {dots.map((dot, index) => (
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
};

export default SessionDots;
