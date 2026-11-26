"use client";

import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { CalendarPeriod } from "@/store/slices/lessons";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

interface DueSessionsProps {
  due: CalendarPeriod[];
  onSelectDay: (day: Date) => void;
}

/** Desktop side column: this month's sessions that still need attendance — a headed hairline list, amber text. */
const DueSessions = ({ due, onSelectDay }: DueSessionsProps) => {
  if (due.length === 0) return null;

  return (
    <section aria-labelledby="due-sessions-heading">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 id="due-sessions-heading" className="text-[17px] font-semibold text-ink">
          還沒點名
        </h2>
        <span className="ml-auto text-[13px] font-semibold tabular-nums text-warning-800">{due.length} 堂</span>
      </div>
      <ul className="divide-y divide-line border-b border-line">
        {due.map((p) => {
          const start = new Date(p.startTime);
          return (
            <li key={p.periodId}>
              <button
                type="button"
                onClick={() => onSelectDay(start)}
                className="-mx-3 flex min-h-12 w-[calc(100%+1.5rem)] cursor-pointer items-center gap-3 rounded-xl px-3 text-left hover:bg-primary-50"
              >
                <span className="w-20 shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-warning-800">
                  {format(start, "M/d")} 週{WEEKDAYS[start.getDay()]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{p.lessonName}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default DueSessions;
