"use client";

import Link from "next/link";
import { differenceInMinutes, format, isToday } from "date-fns";
import { CalendarOff, ChevronRight } from "lucide-react";
import { CalendarPeriod } from "@/store/slices/lessons";
import { Skeleton } from "@/components/ui/skeleton";
import DanceStyleDot from "@/components/DanceStyleDot";
import EmptyState from "@/components/EmptyState";
import { sessionState, type SessionState } from "./status";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

interface DaySessionListProps {
  day: Date;
  periods: CalendarPeriod[];
  loading?: boolean;
}

/** 還沒點名的直接進點名頁，其他進課程頁。 */
const hrefFor = (p: CalendarPeriod, state: SessionState) =>
  state === "due" ? `/lessons/${p.lessonId}/periods/${p.periodId}/check` : `/lessons/${p.lessonId}`;

/** 狀態寫成字：要動作的是琥珀色，其餘是淡字。 */
const StateText = ({ p, state }: { p: CalendarPeriod; state: SessionState }) =>
  state === "due" ? (
    <span className="text-[13px] font-semibold text-warning-800">去點名</span>
  ) : state === "taken" ? (
    <span className="text-[13px] tabular-nums text-ink-3">已點名 · {p.attendeeCount} 人</span>
  ) : (
    <span className="text-[13px] text-ink-3">未開始</span>
  );

/** 選到的那天：標題＋細線清單，一堂一列（時間、舞種點、課名，下面一行分部 · 老師）。 */
const DaySessionList = ({ day, periods, loading }: DaySessionListProps) => {
  const now = new Date();

  return (
    <section aria-labelledby="day-sessions-heading">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 id="day-sessions-heading" className="text-[17px] font-semibold tabular-nums text-ink">
          {format(day, "M/d")}（{WEEKDAYS[day.getDay()]}）
        </h2>
        {isToday(day) && <span className="text-[13px] font-semibold text-primary-800">今天</span>}
        {!loading && periods.length > 0 && (
          <span className="ml-auto text-[13px] tabular-nums text-ink-3">{periods.length} 堂</span>
        )}
      </div>

      {loading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-13 w-full rounded-xl" />
          <Skeleton className="h-13 w-full rounded-xl opacity-60" />
        </div>
      ) : periods.length === 0 ? (
        <EmptyState kind="inline" icon={<CalendarOff />} title="這天沒有課程" />
      ) : (
        <ul className="divide-y divide-line border-b border-line">
          {periods.map((p) => {
            const state = sessionState(p, now);
            const minutes = differenceInMinutes(new Date(p.endTime), new Date(p.startTime));
            const meta = [
              `${format(new Date(p.startTime), "HH:mm")}–${format(new Date(p.endTime), "HH:mm")}`,
              minutes > 0 && `${minutes} 分`,
              p.location?.name,
              p.teacherNames.length > 0 && `老師 ${p.teacherNames.join("、")}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={p.periodId}>
                <Link
                  href={hrefFor(p, state)}
                  className="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 hover:bg-primary-50"
                >
                  <span className="w-11 shrink-0 text-[15px] font-medium tabular-nums text-ink-2">
                    {format(new Date(p.startTime), "HH:mm")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2.5">
                      <DanceStyleDot style={p.danceStyle} />
                      <span className="truncate text-[15px] font-medium text-ink">{p.lessonName}</span>
                    </span>
                    <span className="block truncate text-[13px] tabular-nums text-ink-3">{meta}</span>
                  </span>
                  <span className="shrink-0">
                    <StateText p={p} state={state} />
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default DaySessionList;
