import { periodInfo } from "@/lib/utils";
import { Period } from "@/store/slices/lessons";

const PeriodInfo = ({ period }: { period: Period }) => {
  const { date, startHour, endHour } = periodInfo(period);

  return (
    <div className="flex items-center justify-between border-b border-gray-200 pb-4">
      <div className="text-sm font-semibold">{date}</div>
      <div className="flex items-center gap-1 text-sm ">
        <span>{startHour}</span>
        <span>~</span>
        <span>{endHour}</span>
      </div>
    </div>
  );
};

export default PeriodInfo;
