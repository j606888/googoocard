import { periodInfo } from "@/lib/utils";
import { Period } from "@/store/slices/lessons";
import { CalendarDays, Clock, TriangleAlert } from "lucide-react";
import { format, isToday } from "date-fns";

const PeriodInfo = ({ period }: { period: Period }) => {
  const { date, startHour, endHour } = periodInfo(period);

  // 點名寫到錯的日期已經在 production 發生兩次（見 docs/roadmap.md P2-2）：
  // 只要有舊時段沒點名，老師就可能被帶到那一天而不自知。這裡把「不是今天」
  // 從一般資訊升級成警示——日期跟其他欄位同級的時候沒有人會注意到。
  const isTodayPeriod = isToday(new Date(period.startTime));

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
          isTodayPeriod
            ? "border-neutral-200 bg-neutral-50"
            : "border-warning-300 bg-warning-50"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-sm font-semibold ${
            isTodayPeriod ? "text-neutral-900" : "text-warning-900"
          }`}
        >
          <CalendarDays
            className={`w-4 h-4 ${isTodayPeriod ? "text-neutral-400" : "text-warning-700"}`}
          />
          <span>{date}</span>
        </div>
        <div
          className={`flex items-center gap-1.5 text-sm ${
            isTodayPeriod ? "text-neutral-600" : "text-warning-900"
          }`}
        >
          <Clock className={`w-4 h-4 ${isTodayPeriod ? "text-neutral-400" : "text-warning-700"}`} />
          <span>{startHour}</span>
          <span>~</span>
          <span>{endHour}</span>
        </div>
      </div>

      {!isTodayPeriod && (
        <div className="flex items-start gap-2 px-1 text-sm font-semibold text-warning-900">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-warning-700" />
          <span>
            {`這是 ${format(new Date(period.startTime), "M月d日")} 的課，不是今天（${format(
              new Date(),
              "M月d日"
            )}）。確定要點這一堂嗎？`}
          </span>
        </div>
      )}
    </div>
  );
};

export default PeriodInfo;
