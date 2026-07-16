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
    <div className={loading ? "opacity-60 transition-opacity" : ""}>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-neutral-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
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
