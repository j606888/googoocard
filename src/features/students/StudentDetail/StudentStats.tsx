"use client";

import { differenceInCalendarDays, format } from "date-fns";
import type { StudentWithDetail } from "@/store/slices/students";
import { lastAttendLabel } from "../StudentList/studentFilters";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 剩這麼多堂（含）以下，剩餘堂數這格改成提醒色。 */
const LOW_REMAINING = 2;

/** Same rule as CardsSection's 有效課卡: sessions left AND not ended. */
export const activeStudentCards = (student: StudentWithDetail) =>
  student.studentCards.filter((card) => card.remainingSessions > 0 && !card.expiredAt);

const Tile = ({
  label,
  value,
  unit,
  sub,
  warn = false,
  compact = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  warn?: boolean;
  compact?: boolean;
}) => {
  const valueSize = compact
    ? value.length > 5
      ? "text-base leading-7"
      : "text-lg leading-7"
    : value.length > 5
      ? "text-lg leading-8"
      : "text-2xl";
  return (
    <div
      className={`border min-w-0 ${compact ? "rounded-xl px-2.5 py-2" : "rounded-xl px-3.5 py-3"} ${
        warn ? "bg-warning-50 border-warning-300" : "bg-white border-neutral-200"
      }`}
    >
      <div className={`${compact ? "text-[11px]" : "text-xs"} text-neutral-600`}>{label}</div>
      <div
        className={`mt-0.5 font-bold truncate ${valueSize} ${warn ? "text-warning-950" : "text-neutral-900"}`}
      >
        {value}
        {unit && (
          <span className={`ml-0.5 font-medium text-neutral-600 ${compact ? "text-xs" : "text-sm"}`}>
            {unit}
          </span>
        )}
      </div>
      <div className={`${compact ? "text-[11px]" : "text-xs"} text-neutral-600 truncate`}>{sub}</div>
    </div>
  );
};

/**
 * The four numbers under a student's name: 剩餘堂數／最近上課／本月出席／累計上課.
 * 最近上課 is the class date (not when attendance was taken) — see
 * toLastAttendance. Counts come from `overview` (attendanceCounts).
 */
const StudentStats = ({
  student,
  variant = "full",
}: {
  student: StudentWithDetail;
  /**
   * "full"    —— 桌面頁首四格。
   * "compact" —— 手機頁首三格（剩餘／最近上課／本月），累計上課留在出席分頁。
   */
  variant?: "full" | "compact";
}) => {
  const compact = variant === "compact";
  const { overview } = student;
  const active = activeStudentCards(student);
  const remaining = active.reduce((sum, card) => sum + card.remainingSessions, 0);
  const lastAt = overview.lastAttendAt ? new Date(overview.lastAttendAt) : null;
  const daysAgo = lastAt ? differenceInCalendarDays(new Date(), lastAt) : null;

  const lastValue = lastAt ? `${format(lastAt, "M/d")}（${WEEKDAYS[lastAt.getDay()]}）` : "—";

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-2">
        <Tile
          compact
          label="剩餘"
          value={active.length === 0 ? "—" : String(remaining)}
          unit={active.length === 0 ? undefined : "堂"}
          sub={active.length === 0 ? "沒有有效卡" : `${active.length} 張有效卡`}
          warn={active.length > 0 && remaining <= LOW_REMAINING}
        />
        <Tile compact label="最近上課" value={lastValue} sub={lastAttendLabel(daysAgo)} />
        <Tile
          compact
          label="本月"
          value={String(overview.thisMonthCount)}
          unit="堂"
          sub={`上月 ${overview.lastMonthCount} 堂`}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 @3xl:grid-cols-4 gap-3">
      <Tile
        label="剩餘堂數"
        value={active.length === 0 ? "—" : String(remaining)}
        unit={active.length === 0 ? undefined : "堂"}
        sub={active.length === 0 ? "沒有有效課卡" : `${active.length} 張有效卡合計`}
        warn={active.length > 0 && remaining <= LOW_REMAINING}
      />
      <Tile
        label="最近上課"
        value={lastValue}
        sub={
          lastAt
            ? [overview.lastAttendLessonName, lastAttendLabel(daysAgo)].filter(Boolean).join(" · ")
            : "尚未上課"
        }
      />
      <Tile
        label="本月出席"
        value={String(overview.thisMonthCount)}
        unit="堂"
        sub={`上月 ${overview.lastMonthCount} 堂`}
      />
      <Tile
        label="累計上課"
        value={String(overview.attendedCount)}
        unit="堂"
        sub={`${format(new Date(student.createdAt), "yyyy/MM")} 加入`}
      />
    </div>
  );
};

export default StudentStats;
