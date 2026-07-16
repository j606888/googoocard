"use client";

import { isSameMonth, format } from "date-fns";
import { CalendarPeriod } from "@/store/slices/lessons";
import { DANCE_TYPE_META } from "@/lib/danceTypes";
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
  const extra = periods.length - dots.length;

  return (
    <button
      onClick={() => onSelect(day)}
      className={`relative flex flex-col items-center gap-1 min-h-14 pb-1.5 rounded-lg pt-1.5 transition-colors ${
        selected
          ? "bg-primary-500 text-white"
          : isToday
          ? "bg-primary-50 hover:bg-primary-100"
          : "hover:bg-neutral-100"
      } ${inMonth ? "" : "opacity-40"}`}
    >
      <span
        className={`text-xs font-medium leading-none ${
          selected
            ? "text-white"
            : isToday
            ? "text-primary-700 font-bold"
            : "text-neutral-700"
        }`}
      >
        {format(day, "d")}
      </span>

      {/* Dance-type dots + due marker */}
      <div className="flex items-center gap-0.5 h-2">
        {dots.map((p) => (
          <span
            key={p.periodId}
            className={`w-1.5 h-1.5 rounded-full ${
              selected ? "bg-white/90" : DANCE_TYPE_META[p.danceType].dot
            }`}
          />
        ))}
        {extra > 0 && (
          <span
            className={`text-[9px] leading-none ${
              selected ? "text-white/90" : "text-neutral-400"
            }`}
          >
            +{extra}
          </span>
        )}
      </div>

      {hasDue && (
        <span
          className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
            selected ? "bg-white" : "bg-warning-500"
          }`}
          aria-label="待點名"
        />
      )}
    </button>
  );
};

export default DayCell;
