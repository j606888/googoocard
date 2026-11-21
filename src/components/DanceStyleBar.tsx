import type { DanceStyleSummary } from "@/lib/danceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
} as const;

/**
 * 課的舞種色條：一條直的圓角色條，跟「最近上過」同一種寫法。取代以前的
 * 縮寫色塊（Ba／Sa／Bm）——縮寫沒帶來資訊，課名就在旁邊。顏色一律走 `danceStyleMeta()`。
 */
const DanceStyleBar = ({
  style,
  size = "md",
  className,
}: {
  style: Pick<DanceStyleSummary, "name" | "color"> | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn("w-1.5 shrink-0 rounded-full", !style && "bg-neutral-200", SIZES[size], className)}
    style={style ? danceStyleMeta(style).fill : undefined}
  />
);

export default DanceStyleBar;
