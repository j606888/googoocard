import { periodInfo } from "@/lib/utils";
import { Period } from "@/store/slices/lessons";
import { CalendarDays, Clock } from "lucide-react";

const PeriodInfo = ({ period }: { period: Period }) => {
  const { date, startHour, endHour } = periodInfo(period);

  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <CalendarDays className="w-4 h-4 text-neutral-400" />
        <span>{date}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-neutral-600">
        <Clock className="w-4 h-4 text-neutral-400" />
        <span>{startHour}</span>
        <span>~</span>
        <span>{endHour}</span>
      </div>
    </div>
  );
};

export default PeriodInfo;
