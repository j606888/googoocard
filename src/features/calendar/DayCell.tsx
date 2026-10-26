"use client";

import { isSameMonth, format } from "date-fns";
import { CalendarPeriod } from "@/store/slices/lessons";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { sessionState } from "./status";

interface DayCellProps {
  day: Date;
  viewMonth: Date;
  selected: boolean;
  isToday: boolean;
  periods: CalendarPeriod[];
  onSelect: (day: Date) => void;
  now: Date;
}

const MAX_DOTS = 3;
const MAX_CHIPS = 3;

/**
 * One day of the month grid. Phone: number + dance-style dots (the day's list
 * sits below the grid). Desktop (`lg:`): a taller cell that lists the sessions
 * themselves as chips, so the month reads without clicking each day.
 */
const DayCell = ({
  day,
  viewMonth,
  selected,
  isToday,
  periods,
  onSelect,
  now,
}: DayCellProps) => {
  const inMonth = isSameMonth(day, viewMonth);
  const hasDue = periods.some((p) => sessionState(p, now) === "due");
  const dots = periods.slice(0, MAX_DOTS);
  const extraDots = periods.length - dots.length;
  const chips = periods.slice(0, MAX_CHIPS);
  const extraChips = periods.length - chips.length;

  const cellTone = selected
    ? "bg-primary-900 text-white lg:bg-primary-50 lg:text-neutral-900 lg:ring-2 lg:ring-inset lg:ring-primary-700"
    : isToday
    ? "bg-primary-50 hover:bg-primary-100 lg:bg-white lg:hover:bg-neutral-50"
    : "hover:bg-neutral-100 lg:hover:bg-neutral-50";

  const numberTone = isToday
    ? selected
      ? "text-white lg:bg-primary-900"
      : "text-primary-900 font-bold lg:bg-primary-900 lg:text-white"
    : selected
    ? "text-white lg:text-neutral-900"
    : "text-neutral-700";

  return (
    <button
      onClick={() => onSelect(day)}
      aria-label={`${format(day, "M 月 d 日")}，${periods.length} 堂課${hasDue ? "，有待點名" : ""}`}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-1 min-h-14 pb-1.5 rounded-lg pt-1.5 transition-colors lg:items-stretch lg:min-h-28 lg:rounded-none lg:p-2 lg:text-left lg:border-b lg:border-r lg:border-neutral-100 lg:[&:nth-child(7n)]:border-r-0 lg:[&:nth-last-child(-n+7)]:border-b-0 ${cellTone} ${
        inMonth ? "" : "opacity-40 lg:opacity-100 lg:bg-neutral-50/70 lg:text-neutral-400"
      }`}
    >
      <span
        className={`text-xs font-medium leading-none lg:self-start lg:flex lg:items-center lg:justify-center lg:min-w-6 lg:h-6 lg:px-1.5 lg:rounded-full lg:text-[13px] lg:font-semibold ${numberTone} ${
          inMonth ? "" : "lg:text-neutral-400"
        }`}
      >
        {format(day, "d")}
      </span>

      {/* Phone: dance-style dots */}
      <div className="flex items-center gap-0.5 h-2 lg:hidden">
        {dots.map((p) => (
          <span
            key={p.periodId}
            className={`w-1.5 h-1.5 rounded-full ${
              selected ? "bg-white/90" : danceStyleMeta(p.danceStyle).dot
            }`}
          />
        ))}
        {extraDots > 0 && (
          <span
            className={`text-[9px] leading-none ${
              selected ? "text-white/90" : "text-neutral-500"
            }`}
          >
            +{extraDots}
          </span>
        )}
      </div>

      {hasDue && (
        <span
          className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ring-[1.5px] lg:hidden ${
            selected ? "bg-white ring-primary-900" : "bg-warning-500 ring-white"
          }`}
        />
      )}

      {/* Desktop: the sessions themselves */}
      <div className="hidden lg:flex flex-col gap-1 min-w-0">
        {chips.map((p) => {
          const style = danceStyleMeta(p.danceStyle);
          const state = sessionState(p, now);
          return (
            <span
              key={p.periodId}
              className={`flex items-center gap-1.5 min-w-0 rounded-sm px-1.5 py-0.5 text-[11.5px] leading-snug ${
                state === "due"
                  ? "bg-white text-warning-950 ring-[1.5px] ring-inset ring-warning-400"
                  : `${style.badge} ${state === "taken" ? "opacity-60" : ""}`
              }`}
            >
              <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${style.dot}`} />
              <span className="shrink-0 tabular-nums opacity-80">
                {format(new Date(p.startTime), "HH:mm")}
              </span>
              <span className="truncate font-medium">{p.lessonName}</span>
            </span>
          );
        })}
        {extraChips > 0 && (
          <span className="px-1.5 text-[11px] text-neutral-500">+{extraChips} 堂</span>
        )}
      </div>
    </button>
  );
};

export default DayCell;
