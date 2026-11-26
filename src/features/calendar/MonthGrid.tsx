"use client";

import { isSameDay, format } from "date-fns";
import { CalendarPeriod } from "@/store/slices/lessons";
import DayCell from "./DayCell";

interface MonthGridProps {
  days: Date[];
  viewMonth: Date;
  selectedDay: Date;
  periodsByDay: Map<string, CalendarPeriod[]>;
  onSelectDay: (day: Date) => void;
  loading?: boolean;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const MonthGrid = ({
  days,
  viewMonth,
  selectedDay,
  periodsByDay,
  onSelectDay,
  loading,
}: MonthGridProps) => {
  const now = new Date();

  return (
    <div
      className={`border-b border-line lg:min-w-0 ${loading ? "opacity-60 transition-opacity" : ""}`}
    >
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1.5 text-center text-xs font-medium text-ink-3 lg:px-2 lg:py-2 lg:text-left lg:text-[13px]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 [&>*:nth-child(n+8)]:border-t [&>*]:border-line">
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            day={day}
            viewMonth={viewMonth}
            selected={isSameDay(day, selectedDay)}
            isToday={isSameDay(day, now)}
            periods={periodsByDay.get(format(day, "yyyy-MM-dd")) ?? []}
            onSelect={onSelectDay}
            now={now}
          />
        ))}
      </div>
    </div>
  );
};

export default MonthGrid;
