import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
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
          <EmptyState kind="inline" title="還沒有時段" description="至少新增一個時段才能繼續" />
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
      <div className="flex items-center justify-between w-full px-4 py-2.5 border border-neutral-200 bg-white rounded-xl">
        <span className="text-sm font-semibold text-neutral-900">
          {date}, {weekday}
        </span>
        <span className="text-xs text-neutral-600">
          {format(new Date(period.startTime), "hh:mm aa")}
          {" ~ "}
          {format(new Date(period.endTime), "hh:mm aa")}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="iconSm"
        aria-label="刪除時段"
        className="text-neutral-500"
        onClick={onDelete}
      >
        <Trash className="size-4" />
      </Button>
    </div>
  );
};

export default PeriodList;
