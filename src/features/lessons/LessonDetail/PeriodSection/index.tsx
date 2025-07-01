import { Period } from "@/store/slices/lessons";
import NewPeriod from "./NewPeriod";
import { format } from "date-fns";
import { EllipsisVertical, PenTool } from "lucide-react";
import { useRouter } from "next/navigation";

const PeriodSection = ({ periods }: { periods: Period[] }) => {
  const firstPendingPeriodId = periods[0]?.id;

  return (
    <div className="flex flex-col gap-4 px-5">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-medium">
          Total {periods.length} periods
        </h3>
        <NewPeriod />
      </div>
      <div className="flex flex-col gap-3">
        {periods.map((period) => (
          <PeriodCard
            key={period.id}
            period={period}
            canCheck={period.id === firstPendingPeriodId}
          />
        ))}
      </div>
    </div>
  );
};

const PeriodCard = ({
  period,
  canCheck = false,
}: {
  period: Period;
  canCheck?: boolean;
}) => {
  const router = useRouter();
  const startTime = new Date(period.startTime);
  const endTime = new Date(period.endTime);
  const date = format(startTime, "yyyy/MM/dd, EEE");
  const startHour = format(startTime, "h:mm a");
  const endHour = format(endTime, "h:mm a");

  const handleCheck = () => {
    router.push(`/lessons/${period.lessonId}/periods/${period.id}/check`);
  };

  return (
    <div key={period.id} className="flex flex-col gap-3 p-3 border border-gray-200 rounded-md">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{date}</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm ">
            <span>{startHour}</span>
            <span>~</span>
            <span>{endHour}</span>
          </div>
          <EllipsisVertical className="w-4 h-4" />
        </div>
      </div>
      {canCheck && (
        <button className="flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-md text-sm cursor-pointer"
        onClick={handleCheck}
        >
          <PenTool className="w-4 h-4" />
          Check
        </button>
      )}
    </div>
  );
};

export default PeriodSection;
