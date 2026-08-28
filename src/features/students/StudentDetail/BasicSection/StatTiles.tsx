import { StudentWithDetail } from "@/store/slices/students";
import { CircleDollarSign, Clock } from "lucide-react";
import { format } from "date-fns";

const StatTiles = ({ overview }: { overview: StudentWithDetail["overview"] }) => {
  const lastClassLabel = overview.lastAttendAt
    ? format(new Date(overview.lastAttendAt), "yyyy年M月d日")
    : "尚未上課";

  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile
        icon={CircleDollarSign}
        label="累計消費"
        value={`$${overview.totalSpend.toLocaleString()}`}
      />
      <Tile icon={Clock} label="最近上課" value={lastClassLabel} />
    </div>
  );
};

const Tile = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-4 border border-neutral-200 rounded-2xl bg-white">
      <div className="flex items-center gap-1 text-xs text-neutral-400">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-neutral-900">{value}</div>
    </div>
  );
};

export default StatTiles;
