import { periodInfo } from "@/lib/utils";
import { Period } from "@/store/slices/lessons";
import { CalendarDays, Clock, TriangleAlert } from "lucide-react";
import { format } from "date-fns";
import { periodNotice } from "./periodNotice";

const PeriodInfo = ({ period }: { period: Period }) => {
  const { date, startHour, endHour } = periodInfo(period);

  // 點名寫到錯的日期已經在 production 發生兩次（見 docs/roadmap.md P2-2）：
  // 只要有舊時段沒點名，老師就可能被帶到那一天而不自知。這裡把「不是今天」
  // 從一般資訊升級成警示——日期跟其他欄位同級的時候沒有人會注意到。
  // 今天但還沒開始的時段也在這裡提醒（不用瀏覽器原生 confirm）。
  const notice = periodNotice(new Date(period.startTime));
  const isTodayPeriod = notice !== "notToday";

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
          <span>{startHour}</span>
          <span>~</span>
          <span>{endHour}</span>
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2 px-1 text-sm font-semibold text-warning-950">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-warning-700" />
          <span>
            {notice === "notToday"
              ? `這是 ${format(new Date(period.startTime), "M月d日")} 的課，不是今天（${format(
                  new Date(),
                  "M月d日"
                )}）。確定要點這一堂嗎？`
              : `這個時段 ${startHour} 才開始，確定要現在點名嗎？`}
          </span>
        </div>
      )}
    </div>
  );
};

export default PeriodInfo;
