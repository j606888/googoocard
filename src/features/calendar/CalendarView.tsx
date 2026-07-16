"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  eachDayOfInterval,
  addDays,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGetCalendarPeriodsQuery, CalendarPeriod } from "@/store/slices/lessons";
import MonthGrid from "./MonthGrid";
import DaySessionList from "./DaySessionList";

const dayKey = (date: Date | string) => format(new Date(date), "yyyy-MM-dd");

const CalendarView = () => {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  // Visible grid spans whole weeks, so leading/trailing days from adjacent
  // months are covered too.
  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const from = gridStart.toISOString();
  const to = addDays(startOfDay(days[days.length - 1]), 1).toISOString();

  const { data: periods, isLoading } = useGetCalendarPeriodsQuery({ from, to });

  // Group sessions by their local calendar day.
  const periodsByDay = useMemo(() => {
    const map = new Map<string, CalendarPeriod[]>();
    (periods ?? []).forEach((p) => {
      const key = dayKey(p.startTime);
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    });
    return map;
  }, [periods]);

  const selectedPeriods = periodsByDay.get(dayKey(selectedDay)) ?? [];

  const goToMonth = (next: Date) => {
    setViewMonth(startOfMonth(next));
  };

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Calendar</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToMonth(subMonths(viewMonth, 1))}
            className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-28 text-center font-medium text-neutral-800">
            {format(viewMonth, "yyyy 年 M 月")}
          </span>
          <button
            onClick={() => goToMonth(addMonths(viewMonth, 1))}
            className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <MonthGrid
        days={days}
        viewMonth={viewMonth}
        selectedDay={selectedDay}
        periodsByDay={periodsByDay}
        onSelectDay={setSelectedDay}
        loading={isLoading}
      />

      <DaySessionList day={selectedDay} periods={selectedPeriods} />
    </div>
  );
};

export default CalendarView;
