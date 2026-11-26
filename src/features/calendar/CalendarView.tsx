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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGetCalendarPeriodsQuery, CalendarPeriod } from "@/store/slices/lessons";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import FilterChip from "@/components/FilterChip";
import { Button } from "@/components/ui/button";
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

  const summaryLine = [
    `本月 ${summary.total} 堂`,
    `已點名 ${summary.taken} 堂`,
    summary.attendees > 0 && `出席 ${summary.attendees} 人次`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex w-full flex-col px-5 pb-10 pt-3 lg:max-w-[1180px] lg:px-12 lg:pt-9">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 lg:mb-6">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold text-ink">行事曆</h1>
          {/* 這個月一眼看完：一行字，不放統計格。 */}
          <p className="min-h-5 text-[13px] tabular-nums text-ink-3">{loading ? "" : summaryLine}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToMonth(subMonths(viewMonth, 1))}
            aria-label="上個月"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <span className="min-w-28 text-center text-[15px] font-semibold tabular-nums text-ink">
            {format(viewMonth, "yyyy 年 M 月")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToMonth(addMonths(viewMonth, 1))}
            aria-label="下個月"
          >
            <ChevronRight className="size-5" />
          </Button>
          <Button variant="text" size="sm" onClick={goToday} disabled={viewingToday} className="ml-1">
            今天
          </Button>
        </div>
      </header>

      {!loading && (summary.due.length > 0 || styleOptions.length > 1) && (
        <div className={`mb-4 flex flex-col gap-3 ${styleOptions.length > 1 ? "" : "lg:hidden"}`}>
          {/* 手機：還沒點名的課用一條琥珀提醒，一路跳到下一堂。電腦版在右欄列出來。 */}
          {summary.due.length > 0 && (
            <button
              type="button"
              onClick={goToNextDue}
              className="flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-xl bg-warning-100 px-4 py-2.5 text-left text-warning-950 hover:bg-warning-200/60 lg:hidden"
            >
              <b className="min-w-0 flex-1 font-semibold">{summary.due.length} 堂還沒點名</b>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
                跳到下一堂
                <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            </button>
          )}

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
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={meta.fill} />
                  {meta.label}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-16">
        <MonthGrid
          days={days}
          viewMonth={viewMonth}
          selectedDay={selectedDay}
          periodsByDay={periodsByDay}
          onSelectDay={selectDay}
          loading={loading}
        />

        <div aria-hidden className="-mx-5 my-7 h-2 bg-band lg:hidden" />

        <div className="flex flex-col lg:sticky lg:top-6">
          <DaySessionList day={selectedDay} periods={selectedPeriods} loading={loading} />
          {!loading && (
            <div className="hidden lg:mt-9 lg:block">
              <DueSessions due={summary.due} onSelectDay={selectDay} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
