"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Check, AlarmClock, Clock, CalendarOff } from "lucide-react";
import { CalendarPeriod } from "@/store/slices/lessons";
import { DANCE_TYPE_META } from "@/lib/danceTypes";
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
}

const DaySessionList = ({ day, periods }: DaySessionListProps) => {
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
    <div className="mt-5 border-t border-neutral-200 pt-4">
      <h3 className="text-sm font-semibold text-neutral-700 mb-3">
        {format(day, "M/d")} ({WEEKDAYS[day.getDay()]})
      </h3>

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral-400">
          <CalendarOff className="w-6 h-6" />
          <p className="text-sm">這天沒有課程</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {periods.map((p) => {
            const style = DANCE_TYPE_META[p.danceType];
            const state = sessionState(p, now);
            return (
              <button
                key={p.periodId}
                onClick={() => handleClick(p)}
                className="group flex items-stretch gap-0 rounded-xl border border-neutral-200 bg-white overflow-hidden text-left hover:border-neutral-300 hover:shadow-sm transition-all"
              >
                <div className={`w-1.5 shrink-0 ${style.bg}`} />
                <div className="flex flex-col gap-1.5 p-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500 tabular-nums">
                      {formatTime(p.startTime)}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900 truncate flex-1 min-w-0">
                      {p.lessonName}
                    </span>
                    {state === "taken" && (
                      <span className="flex items-center gap-1 shrink-0 text-xs font-medium text-primary-600">
                        <Check className="w-3.5 h-3.5" />
                        已點名 · {p.attendeeCount} 人
                      </span>
                    )}
                    {state === "due" && (
                      <span className="flex items-center gap-1 shrink-0 text-xs font-semibold text-warning-600">
                        <AlarmClock className="w-3.5 h-3.5" />
                        待點名
                      </span>
                    )}
                    {state === "upcoming" && (
                      <span className="flex items-center gap-1 shrink-0 text-xs font-medium text-neutral-400">
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
