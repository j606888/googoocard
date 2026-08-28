import { Snail, Trash } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

const PeriodList = ({
  periods,
  onDelete,
}: {
  periods: { startTime: string; endTime: string }[];
  onDelete: (index: number) => void;
}) => {
  return (
    <div>
      <div className="flex flex-col gap-3 mt-4 mb-20">
        {periods.map((period, index) => (
          <PeriodCard
            key={index}
            period={period}
            onDelete={() => onDelete(index)}
          />
        ))}
        {periods.length === 0 && (
          <div className="bg-primary-100 rounded-sm p-6 flex flex-col gap-3 items-center">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
              <Snail className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <h4 className="text-lg font-semibold">還沒有時段</h4>
              <p className="text-sm text-neutral-500">
                至少新增一個時段才能繼續
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PeriodCard = ({
  period,
  onDelete,
}: {
  period: { startTime: string; endTime: string };
  onDelete: () => void;
}) => {
  const date = format(new Date(period.startTime), "M月d日");
  const weekday = format(new Date(period.startTime), "EEE", { locale: zhTW });

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-between w-full px-3 py-2 bg-primary-100 rounded-sm">
        <span className="text-sm font-semibold">
          {date}, {weekday}
        </span>
        <span className="text-xs">
          {format(new Date(period.startTime), "hh:mm aa")}
          {" ~ "}
          {format(new Date(period.endTime), "hh:mm aa")}
        </span>
      </div>
      <Trash className="w-4 h-4 cursor-pointer" onClick={onDelete} />
    </div>
  );
};

export default PeriodList;
