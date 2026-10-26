"use client";
import LocationBadge from "@/components/LocationBadge";

import { differenceInMinutes, format, isToday } from "date-fns";
import { useRouter } from "next/navigation";
import { Check, AlarmClock, Clock, CalendarOff, GraduationCap } from "lucide-react";
import { CalendarPeriod } from "@/store/slices/lessons";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";
import { sessionState } from "./status";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const formatTime = (value: string) => {
  const date = new Date(value);
  const hours = date.getHours();
  const period = hours < 12 ? "上午" : "下午";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${h12}:${format(date, "mm")}`;
};

interface DaySessionListProps {
  day: Date;
  periods: CalendarPeriod[];
  loading?: boolean;
}

const DaySessionList = ({ day, periods, loading }: DaySessionListProps) => {
  const router = useRouter();
  const now = new Date();

  const handleClick = (p: CalendarPeriod) => {
    if (sessionState(p, now) === "due") {
      router.push(`/lessons/${p.lessonId}/periods/${p.periodId}/check`);
    } else {
      router.push(`/lessons/${p.lessonId}`);
    }
  };

  return (
    <div className="mt-5 border-t border-neutral-200 pt-4 lg:mt-0 lg:rounded-2xl lg:border lg:p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-700 mb-3 lg:text-base lg:text-neutral-900">
        <span>
          {format(day, "M/d")} ({WEEKDAYS[day.getDay()]})
        </span>
        {isToday(day) && (
          <StatusTag tone="positive">今天</StatusTag>
        )}
        {!loading && periods.length > 0 && (
          <span className="ml-auto text-xs font-medium text-neutral-500">
            {periods.length} 堂
          </span>
        )}
      </h3>

      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-stretch rounded-2xl border border-neutral-200 bg-white overflow-hidden"
            >
              <Skeleton className="w-1.5 shrink-0 rounded-none" />
              <div className="flex flex-col gap-2 p-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 flex-1 max-w-40" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : periods.length === 0 ? (
        <EmptyState kind="inline" icon={<CalendarOff />} title="這天沒有課程" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {periods.map((p) => {
            const style = danceStyleMeta(p.danceStyle);
            const state = sessionState(p, now);
            const minutes = differenceInMinutes(new Date(p.endTime), new Date(p.startTime));
            return (
              <button
                key={p.periodId}
                onClick={() => handleClick(p)}
                className={`group flex items-stretch gap-0 rounded-2xl border bg-white overflow-hidden text-left cursor-pointer transition-colors ${
                  state === "due"
                    ? "border-warning-400 hover:border-warning-500"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div className={`w-1.5 shrink-0 ${style.bg}`} />
                <div className="flex flex-col gap-1.5 p-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-600 tabular-nums">
                      {formatTime(p.startTime)} – {format(new Date(p.endTime), "HH:mm")}
                    </span>
                    {minutes > 0 && (
                      <span className="text-xs text-neutral-500">{minutes} 分</span>
                    )}
                    <LocationBadge location={p.location} className="ml-auto" />
                    <span
                      className={`${p.location ? "" : "ml-auto "}text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <span className="font-semibold text-neutral-900 truncate">
                    {p.lessonName}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    {p.teacherNames.length > 0 && (
                      <span className="flex items-center gap-1 min-w-0 text-xs text-neutral-500">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{p.teacherNames.join("、")}</span>
                      </span>
                    )}
                    {state === "taken" && (
                      <span className="ml-auto flex items-center gap-1 shrink-0 text-xs font-medium text-primary-700">
                        <Check className="w-3.5 h-3.5" />
                        已點名 · {p.attendeeCount} 人
                      </span>
                    )}
                    {state === "due" && (
                      <span className="ml-auto flex items-center gap-1 shrink-0 rounded-full bg-primary-900 px-2.5 py-1 text-xs font-semibold text-white group-hover:bg-primary-700">
                        <AlarmClock className="w-3.5 h-3.5" />
                        去點名
                      </span>
                    )}
                    {state === "upcoming" && (
                      <span className="ml-auto flex items-center gap-1 shrink-0 text-xs font-medium text-neutral-500">
                        <Clock className="w-3.5 h-3.5" />
                        未開始
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DaySessionList;
