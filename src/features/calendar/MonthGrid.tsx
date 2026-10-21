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
      className={`lg:min-w-0 lg:rounded-2xl lg:border lg:border-neutral-200 lg:overflow-hidden ${
        loading ? "opacity-60 transition-opacity" : ""
      }`}
    >
      <div className="grid grid-cols-7 mb-1 lg:mb-0 lg:bg-neutral-50 lg:border-b lg:border-neutral-200">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-neutral-400 py-1 lg:text-left lg:px-3 lg:py-2.5 lg:text-neutral-500"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 lg:gap-0">
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
