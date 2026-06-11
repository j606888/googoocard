import { Star } from "lucide-react";
import { DanceType } from "@prisma/client";
import { danceTypeLabel } from "@/lib/danceTypes";

const StarBadge = ({ type }: { type: DanceType }) => {
  return (
    <div className="flex gap-1 items-center bg-[#DB9618] rounded-lg py-1.5 px-3">
      <Star className="w-4 h-4 text-white" />
      <p className="text-sm text-white">{`可使用 ${danceTypeLabel(type)} LV1 複習卷`}</p>
    </div>
  );
};

export default StarBadge;
