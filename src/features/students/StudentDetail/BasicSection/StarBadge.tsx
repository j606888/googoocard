import { Star } from "lucide-react";
import { DanceType } from "@prisma/client";
import { danceTypeLabel } from "@/lib/danceTypes";
import { DEFAULT_DANCE_LEVEL, danceLevelLabel } from "@/lib/danceLevels";

// Level 1 keeps the original wording so classrooms without levels see no change.
const StarBadge = ({ type, level }: { type: DanceType; level: number }) => {
  const scope =
    level > DEFAULT_DANCE_LEVEL
      ? `${danceLevelLabel(DEFAULT_DANCE_LEVEL)}–${danceLevelLabel(level)}`
      : "Lv1";
  return (
    <div className="inline-flex gap-1.5 items-center bg-warning-100 text-warning-900 rounded-full py-1 pl-2.5 pr-3">
      <Star className="w-3.5 h-3.5 fill-warning-500 text-warning-500" />
      <p className="text-sm font-medium">{`可使用 ${danceTypeLabel(type)} ${scope} 複習卷`}</p>
    </div>
  );
};

export default StarBadge;
