import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format, isToday } from "date-fns";
import type { Period } from "@/store/slices/lessons";

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 手機點名頁的頁首：這是哪一堂、到了幾個人。進度條跟著勾選走，
 * 老師不用往下捲去數。日期不是今天時，頁面另外有一行警示（`NotTodayWarning`）。
 */
const AttendanceHeader = ({
  backUrl,
  lessonName,
  period,
  arrived,
  expected,
}: {
  backUrl: string;
  lessonName: string;
  period: Period;
  arrived: number;
  expected: number;
}) => {
  const start = new Date(period.startTime);
  const percent = expected > 0 ? Math.min(100, Math.round((arrived / expected) * 100)) : 0;
  return (
    <header className="sticky top-0 z-10 rounded-b-[28px] bg-primary-900 px-4 pt-2 pb-4 text-white">
      <div className="flex items-center gap-3">
        <Link
          href={backUrl}
          aria-label="返回"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold leading-6">{lessonName || "點名"}</h1>
          <p className="truncate text-[13px] font-medium tabular-nums text-primary-100">
            {isToday(start) && "今天 "}
            {format(start, "M/d")}（{WEEKDAY[start.getDay()]}）{format(start, "HH:mm")}–
            {format(new Date(period.endTime), "HH:mm")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <p className="shrink-0 text-[32px] font-bold leading-9 tabular-nums">
          {arrived}
          <span className="text-base font-medium text-primary-100"> / {expected} 人到了</span>
        </p>
        <div
          role="progressbar"
          aria-label="出席進度"
          aria-valuemin={0}
          aria-valuemax={expected}
          aria-valuenow={arrived}
          className="h-2 flex-1 overflow-hidden rounded-full bg-white/25"
        >
          <div className="h-2 rounded-full bg-accent-500 transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </header>
  );
};

export default AttendanceHeader;
