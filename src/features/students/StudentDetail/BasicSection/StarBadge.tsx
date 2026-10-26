import { Star } from "lucide-react";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { DEFAULT_DANCE_LEVEL, danceLevelLabel } from "@/lib/danceLevels";

// Level 1, or a style without levels, shows no level range.
const StarBadge = ({ style, level }: { style: DanceStyleSummary; level: number }) => {
  const scope =
    style.hasLevels && level > DEFAULT_DANCE_LEVEL
      ? ` ${danceLevelLabel(DEFAULT_DANCE_LEVEL)}–${danceLevelLabel(level)}`
      : "";
  return (
    <div className="inline-flex gap-1.5 items-center bg-warning-100 text-warning-950 rounded-full py-1 pl-2.5 pr-3">
      <Star className="w-3.5 h-3.5 fill-warning-500 text-warning-500" />
      <p className="text-sm font-medium">{`可使用 ${style.name}${scope} 複習卷`}</p>
    </div>
  );
};

export default StarBadge;
