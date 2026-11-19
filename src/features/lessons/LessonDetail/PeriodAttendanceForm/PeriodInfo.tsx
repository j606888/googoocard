import { Period } from "@/store/slices/lessons";
import { CalendarDays, Clock, TriangleAlert } from "lucide-react";
import { format, isToday } from "date-fns";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 「這是 11/13 的課，不是今天」。手機的新頁首只寫日期，這一行要另外放——
 * 點名寫到錯的日期已經在 production 發生兩次（docs/roadmap.md P2-2）。今天的課不出現。
 */
export const NotTodayWarning = ({ period, className = "" }: { period: Period; className?: string }) =>
  isToday(new Date(period.startTime)) ? null : (
    <div className={`flex items-start gap-2 px-1 text-sm font-semibold text-warning-950 ${className}`}>
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-warning-700" />
      <span>{`這是 ${format(new Date(period.startTime), "M/d")} 的課，不是今天`}</span>
    </div>
  );

const PeriodInfo = ({ period }: { period: Period }) => {
  // 跟手機頁首、今天頁同一種寫法（11/20（五）19:30–21:00），不要這裡突然變成 12 小時制。
  const start = new Date(period.startTime);
  const date = `${isToday(start) ? "今天 " : ""}${format(start, "M/d")}（${WEEKDAYS[start.getDay()]}）`;
  const hours = `${format(start, "HH:mm")}–${format(new Date(period.endTime), "HH:mm")}`;

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
            isTodayPeriod ? "text-neutral-900" : "text-warning-950"
          }`}
        >
          <CalendarDays
            className={`w-4 h-4 ${isTodayPeriod ? "text-neutral-400" : "text-warning-700"}`}
          />
          <span>{date}</span>
        </div>
        <div
          className={`flex items-center gap-1.5 text-sm ${
            isTodayPeriod ? "text-neutral-600" : "text-warning-950"
          }`}
        >
          <Clock className={`w-4 h-4 ${isTodayPeriod ? "text-neutral-400" : "text-warning-700"}`} />
          <span className="tabular-nums">{hours}</span>
        </div>
      </div>

      <NotTodayWarning period={period} />
    </div>
  );
};

export default PeriodInfo;
