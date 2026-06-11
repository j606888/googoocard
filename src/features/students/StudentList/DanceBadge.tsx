import { DanceType } from "@prisma/client";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

const DanceBadge = ({ type }: { type: DanceType }) => {
  const meta = DANCE_TYPE_META[type];
  return (
    <div
      className={`w-6 h-6 ${meta.bg} text-white rounded-full flex items-center justify-center text-sm font-semibold`}
      title={meta.label}
    >
      {meta.label.charAt(0)}
    </div>
  );
};

export default DanceBadge;
