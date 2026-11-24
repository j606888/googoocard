import type { DanceStyleSummary } from "@/lib/danceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { cn } from "@/lib/utils";

/**
 * 舞種小圓點（8px）：去框線改版後清單用它取代左側色條（`DanceStyleBar`）——
 * 顏色只負責「這是哪個舞種」，不再撐起整列的邊。顏色一律走 `danceStyleMeta()`。
 */
const DanceStyleDot = ({
  style,
  className,
}: {
  style: Pick<DanceStyleSummary, "name" | "color"> | null | undefined;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn("inline-block size-2 shrink-0 rounded-full", !style && "bg-neutral-300", className)}
    style={style ? danceStyleMeta(style).fill : undefined}
  />
);

export default DanceStyleDot;
