import type { DanceStyleSummary } from "@/lib/danceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { seriesInitials } from "@/features/lessons/seriesInitials";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-10 rounded-xl text-sm",
  md: "size-13 rounded-2xl text-lg",
  lg: "size-14 rounded-2xl text-xl",
} as const;

/**
 * 課的「臉」：舞種顏色的色塊＋課名縮寫（Ba／Sa／Bm）。取代清單裡那顆小圓點，
 * 一眼分得出是哪一種課。顏色一律走 `danceStyleMeta()`。
 */
const DanceStyleTile = ({
  style,
  name,
  size = "md",
  className,
}: {
  style: Pick<DanceStyleSummary, "name" | "color"> | null | undefined;
  /** 課名或課種名——縮寫從這裡取。 */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "grid shrink-0 place-items-center font-bold text-neutral-900",
      danceStyleMeta(style).bg,
      SIZES[size],
      className
    )}
  >
    {seriesInitials(name)}
  </span>
);

export default DanceStyleTile;
