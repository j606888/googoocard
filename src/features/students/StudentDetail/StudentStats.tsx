"use client";

import { differenceInCalendarDays, format } from "date-fns";
import type { StudentWithDetail } from "@/store/slices/students";
import { NEEDS_RENEWAL_TAG, lastAttendLabel } from "../StudentList/studentFilters";

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
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  warn?: boolean;
}) => (
  <div
    className={`border min-w-0 rounded-xl px-2.5 py-2 ${
      warn ? "bg-warning-50 border-warning-300" : "bg-white border-neutral-200"
    }`}
  >
    <div className="text-[11px] text-neutral-600">{label}</div>
    <div
      className={`mt-0.5 font-bold truncate ${value.length > 5 ? "text-base leading-7" : "text-lg leading-7"} ${
        warn ? "text-warning-950" : "text-neutral-900"
      }`}
    >
      {value}
      {unit && <span className="ml-0.5 font-medium text-neutral-600 text-xs">{unit}</span>}
    </div>
    <div className="text-[11px] text-neutral-600 truncate">{sub}</div>
  </div>
);

const Divider = () => <span aria-hidden="true" className="text-neutral-300">|</span>;

/**
 * The numbers under a student's name: 剩餘堂數／最近上課／本月出席／累計上課.
 * 最近上課 is the class date (not when attendance was taken) — see
 * toLastAttendance. Counts come from `overview` (attendanceCounts).
 */
const StudentStats = ({
  student,
  variant = "strip",
}: {
  student: StudentWithDetail;
  /**
   * "strip"   —— 桌面頁首一行灰底數據列，把高度留給下面的分頁。需續約時剩餘堂數
   *              標紅並接「快用完了」——桌面的 AttentionBar 因此不再重複講需續約。
   * "compact" —— 手機頁首三格（剩餘／最近上課／本月），累計上課留在出席分頁。
   */
  variant?: "strip" | "compact";
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
          label="剩餘"
          value={active.length === 0 ? "—" : String(remaining)}
          unit={active.length === 0 ? undefined : "堂"}
          sub={active.length === 0 ? "沒有有效卡" : `${active.length} 張有效卡`}
          warn={active.length > 0 && remaining <= LOW_REMAINING}
        />
        <Tile label="最近上課" value={lastValue} sub={lastAttendLabel(daysAgo)} />
        <Tile
          label="本月"
          value={String(overview.thisMonthCount)}
          unit="堂"
          sub={`上月 ${overview.lastMonthCount} 堂`}
        />
      </div>
    );
  }

  const needsRenewal = student.tags?.some((tag) => tag.name === NEEDS_RENEWAL_TAG) ?? false;
  return (
    <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[13px] text-neutral-600">
      <span className={needsRenewal ? "text-danger-700" : undefined}>
        {active.length === 0 ? (
          "沒有有效課卡"
        ) : (
          <>
            剩{" "}
            <b className={`text-[15px] ${needsRenewal ? "" : "text-neutral-900"}`}>{remaining}</b> 堂
          </>
        )}
        {needsRenewal && (remaining === 0 ? " · 需要續卡" : " · 快用完了")}
      </span>
      <Divider />
      <span>
        最近上課 <b className="text-neutral-900">{lastValue}</b>
        {lastAt && ` ${lastAttendLabel(daysAgo)}`}
      </span>
      <Divider />
      <span>
        本月 <b className="text-neutral-900">{overview.thisMonthCount}</b> 堂
      </span>
      <Divider />
      <span>
        累計 <b className="text-neutral-900">{overview.attendedCount}</b> 堂
      </span>
    </div>
  );
};

export default StudentStats;
