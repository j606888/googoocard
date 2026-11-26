"use client";

import { isSameMonth, format } from "date-fns";
import { CalendarPeriod } from "@/store/slices/lessons";
import DanceStyleDot from "@/components/DanceStyleDot";
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

/** 一格最多畫幾個點（手機兩排）；再多的堂數寫在 aria-label 與下方當日清單。 */
const MAX_DOTS = 8;

/**
 * One day of the month grid: the date and one dance-style dot per session —
 * no times or counts written in the cell; the selected day's list (below on
 * phones, right column on desktop) carries the details. Days with a session
 * still waiting for attendance get a small amber mark (also in the aria-label).
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

  const numberTone = isToday
    ? "bg-primary-900 font-semibold text-white"
    : selected
    ? "font-semibold text-primary-900"
    : inMonth
    ? "text-ink"
    : "text-ink-3";

  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      aria-label={`${format(day, "M 月 d 日")}，${periods.length} 堂課${hasDue ? "，有待點名" : ""}`}
      aria-pressed={selected}
      className={`relative flex min-h-14 cursor-pointer flex-col items-center gap-1.5 rounded-lg pb-2 pt-1.5 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-primary-300 lg:min-h-20 lg:items-start lg:rounded-none lg:px-2 lg:pt-2 ${
        selected ? "bg-primary-50" : "hover:bg-primary-50/60"
      }`}
    >
      <span
        className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] leading-none tabular-nums ${numberTone}`}
      >
        {format(day, "d")}
      </span>

      <span
        aria-hidden="true"
        className={`flex max-w-full flex-wrap justify-center gap-1 px-1 lg:justify-start lg:px-0 ${
          inMonth ? "" : "opacity-50"
        }`}
      >
        {dots.map((p) => (
          <DanceStyleDot key={p.periodId} style={p.danceStyle} />
        ))}
      </span>

      {hasDue && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 size-1.5 rounded-full bg-warning-500 lg:right-2 lg:top-2"
        />
      )}
    </button>
  );
};

export default DayCell;
