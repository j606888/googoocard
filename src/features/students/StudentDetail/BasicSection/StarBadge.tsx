import { Star } from "lucide-react";
import { DanceType } from "@prisma/client";
import { danceTypeLabel } from "@/lib/danceTypes";

const StarBadge = ({ type }: { type: DanceType }) => {
  return (
    <div className="inline-flex gap-1.5 items-center bg-warning-100 text-warning-900 rounded-full py-1 pl-2.5 pr-3">
      <Star className="w-3.5 h-3.5 fill-warning-500 text-warning-500" />
      <p className="text-sm font-medium">{`可使用 ${danceTypeLabel(type)} Lv1 複習卷`}</p>
    </div>
  );
};

export default StarBadge;
