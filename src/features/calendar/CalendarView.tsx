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
  isSameDay,
} from "date-fns";
import { AlarmClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetCalendarPeriodsQuery, CalendarPeriod } from "@/store/slices/lessons";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import FilterChip from "@/components/FilterChip";
import MonthGrid from "./MonthGrid";
import DaySessionList from "./DaySessionList";
import DueSessions from "./DueSessions";
import {
  filterByStyle,
  styleKeyOf,
  summarizeMonth,
  type StyleFilter,
} from "./calendarSummary";

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

  // currentData is undefined while a new range (e.g. another month) is being
  // fetched, so a fresh month shows skeletons instead of stale/empty sessions.
  const { currentData: periods, isFetching } = useGetCalendarPeriodsQuery({ from, to });
  const loading = periods === undefined && isFetching;

  const [styleFilter, setStyleFilter] = useState<StyleFilter>(null);

  // Filter chips come from the styles actually on the grid — styles are
  // classroom data, never a hardcoded list.
  const styleOptions = useMemo(() => {
    const seen = new Map<string, { key: Exclude<StyleFilter, null>; period: CalendarPeriod }>();
    (periods ?? []).forEach((p) => {
      const key = styleKeyOf(p);
      if (!seen.has(String(key))) seen.set(String(key), { key, period: p });
    });
    return [...seen.values()].map(({ key, period }) => ({
      key,
      meta: danceStyleMeta(period.danceStyle),
    }));
  }, [periods]);

  // A filter for a style that isn't on this month's grid would hide everything.
  const activeFilter = styleOptions.some((o) => o.key === styleFilter) ? styleFilter : null;
  const visiblePeriods = useMemo(
    () => filterByStyle(periods ?? [], activeFilter),
    [periods, activeFilter]
  );

  // Group sessions by their local calendar day.
  const periodsByDay = useMemo(() => {
    const map = new Map<string, CalendarPeriod[]>();
    visiblePeriods.forEach((p) => {
      const key = dayKey(p.startTime);
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    });
    return map;
  }, [visiblePeriods]);

  const summary = useMemo(
    () => summarizeMonth(visiblePeriods, viewMonth, new Date()),
    [visiblePeriods, viewMonth]
  );

  const selectedPeriods = periodsByDay.get(dayKey(selectedDay)) ?? [];

  const goToMonth = (next: Date) => {
    setViewMonth(startOfMonth(next));
  };

  const goToday = () => {
    setViewMonth(startOfMonth(new Date()));
    setSelectedDay(startOfDay(new Date()));
  };

  const selectDay = (day: Date) => setSelectedDay(startOfDay(day));

  // Phone banner: step through the days that still need attendance.
  const goToNextDue = () => {
    const dueDays = summary.due.map((p) => startOfDay(new Date(p.startTime)));
    const next =
      dueDays.find((d) => d.getTime() > selectedDay.getTime()) ?? dueDays[0];
    if (next) setSelectedDay(next);
  };

  const viewingToday =
    isSameDay(selectedDay, new Date()) &&
    startOfMonth(new Date()).getTime() === viewMonth.getTime();

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 lg:mb-4">
        <h2 className="text-2xl font-semibold">行事曆</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToMonth(subMonths(viewMonth, 1))}
            className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="上個月"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-28 text-center font-medium text-neutral-800">
            {format(viewMonth, "yyyy 年 M 月")}
          </span>
          <button
            onClick={() => goToMonth(addMonths(viewMonth, 1))}
            className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="下個月"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToday}
            disabled={viewingToday}
            className="ml-1 rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-default disabled:text-neutral-400 disabled:hover:bg-transparent"
          >
            今天
          </button>
        </div>
      </div>

      {!loading && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          {/* Month at a glance: one line on phones, stat pills on desktop */}
          <p className="text-xs text-neutral-500 lg:hidden">
            本月 {summary.total} 堂 · 已點名 {summary.taken}
          </p>
          <div className="hidden lg:flex flex-wrap gap-2">
            <SummaryPill label="本月課堂" value={summary.total} />
            <SummaryPill label="已點名" value={summary.taken} />
            <SummaryPill label="出席人次" value={summary.attendees} />
            <SummaryPill label="待點名" value={summary.due.length} warn={summary.due.length > 0} />
          </div>

          {styleOptions.length > 1 && (
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="舞種篩選">
              <FilterChip active={activeFilter === null} onClick={() => setStyleFilter(null)}>
                全部
              </FilterChip>
              {styleOptions.map(({ key, meta }) => (
                <FilterChip
                  key={key}
                  active={activeFilter === key}
                  onClick={() => setStyleFilter(key)}
                >
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </FilterChip>
              ))}
            </div>
          )}

          {summary.due.length > 0 && (
            <button
              onClick={goToNextDue}
              className="flex min-h-12 items-center gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-3 text-left text-warning-900 lg:hidden"
            >
              <AlarmClock className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-sm">
                <b className="font-semibold">{summary.due.length} 堂</b>還沒點名 · 跳到下一堂
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <MonthGrid
          days={days}
          viewMonth={viewMonth}
          selectedDay={selectedDay}
          periodsByDay={periodsByDay}
          onSelectDay={selectDay}
          loading={loading}
        />

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <DaySessionList day={selectedDay} periods={selectedPeriods} loading={loading} />
          {!loading && (
            <div className="hidden lg:block">
              <DueSessions due={summary.due} onSelectDay={selectDay} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryPill = ({ label, value, warn }: { label: string; value: number; warn?: boolean }) => (
  <div
    className={`flex items-baseline gap-2 rounded-xl px-4 py-2 ${
      warn ? "bg-warning-50 text-warning-900" : "bg-neutral-50 text-neutral-900"
    }`}
  >
    <span className={`text-sm ${warn ? "" : "text-neutral-500"}`}>{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value}</span>
  </div>
);

export default CalendarView;
