"use client";

import { format } from "date-fns";
import { AlarmClock, ChevronRight } from "lucide-react";
import { CalendarPeriod } from "@/store/slices/lessons";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

interface DueSessionsProps {
  due: CalendarPeriod[];
  onSelectDay: (day: Date) => void;
}

/** Desktop side panel: this month's sessions that still need attendance. */
const DueSessions = ({ due, onSelectDay }: DueSessionsProps) => {
  if (due.length === 0) return null;

  return (
    <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-warning-900">
        <AlarmClock className="h-4 w-4" />
        <h3 className="font-semibold">還沒點名</h3>
        <span className="ml-auto text-sm font-semibold">{due.length} 堂</span>
      </div>
      <div className="flex flex-col">
        {due.map((p) => {
          const start = new Date(p.startTime);
          return (
            <button
              key={p.periodId}
              onClick={() => onSelectDay(start)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-left hover:bg-warning-100"
            >
              <span className="w-20 shrink-0 whitespace-nowrap text-sm font-semibold text-warning-900 tabular-nums">
                {format(start, "M/d")} 週{WEEKDAYS[start.getDay()]}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                {p.lessonName}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-warning-900" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DueSessions;
