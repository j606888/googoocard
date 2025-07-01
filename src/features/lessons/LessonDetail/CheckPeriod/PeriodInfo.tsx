import { Period } from "@/store/slices/lessons";
import { format } from "date-fns";

const PeriodInfo = ({ period }: { period: Period }) => {
  const startTime = new Date(period.startTime);
  const endTime = new Date(period.endTime);
  const date = format(startTime, "yyyy/MM/dd, EEE");
  const startHour = format(startTime, "h:mm a");
  const endHour = format(endTime, "h:mm a");

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
