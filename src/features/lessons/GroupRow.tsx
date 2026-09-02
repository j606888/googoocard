"use client";

import { AlarmClock, ChevronRight, Folder, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { format, isToday, isTomorrow } from "date-fns";
import { DanceType } from "@prisma/client";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * The single column definition, shared by GroupRowHeader and every GroupRow —
 * that sharing is the whole point of this component. Below `lg` the six cells
 * fold into a two-line card; at `lg` they become table columns. The display
 * utility (`grid` / `hidden lg:grid`) is deliberately left to the consumer so
 * `grid` and `hidden` never collide in one class list.
 */
export const GROUP_ROW_COLS =
  "gap-x-3 gap-y-2 grid-cols-[minmax(0,1fr)_auto] " +
  "lg:gap-3 lg:grid-cols-[minmax(0,2.2fr)_132px_64px_64px_140px_168px]";

/** How many dance badges fit the 舞種 column before collapsing into "+N". */
const MAX_DANCE_BADGES = 2;

export interface GroupRowData {
  /** "ungrouped" routes to the virtual 未分類 bucket instead of a real LessonGroup id. */
  id: number | "ungrouped";
  name: string;
  lessonCount: number;
  studentCount: number;
  danceTypes: DanceType[];
  dueForAttendanceCount: number;
  nextSessionDate: string | null;
}

/**
 * A cell of the row. On desktop the header names the column; on phone there is
 * no header row, so each cell carries its own label instead.
 */
const Cell = ({
  label,
  className = "",
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={`flex items-center gap-1.5 min-w-0 text-xs lg:text-sm text-neutral-700 ${className}`}
  >
    {label && <span className="lg:hidden text-neutral-400 shrink-0">{label}</span>}
    {children}
  </div>
);

const formatNextSession = (date: Date) => {
  const time = format(date, "HH:mm");
  if (isToday(date)) return `今天 ${time}`;
  if (isTomorrow(date)) return `明天 ${time}`;
  return `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）${time}`;
};

/** Column titles — desktop only; on phone the labels live inside each Cell. */
export const GroupRowHeader = () => (
  <div
    className={`hidden lg:grid ${GROUP_ROW_COLS} px-4.5 py-2.5 bg-neutral-50 border-b border-neutral-100 text-xs font-semibold text-neutral-500`}
  >
    <div>群組</div>
    <div>舞種</div>
    <div>課程</div>
    <div>學生</div>
    <div>下次上課</div>
    <div>狀態</div>
  </div>
);

const GroupRow = ({ group }: { group: GroupRowData }) => {
  const router = useRouter();
  const isUngrouped = group.id === "ungrouped";
  const hasDue = group.dueForAttendanceCount > 0;
  const isEmpty = group.lessonCount === 0;
  const nextDate = group.nextSessionDate ? new Date(group.nextSessionDate) : null;

  const shownDanceTypes = group.danceTypes.slice(0, MAX_DANCE_BADGES);
  const hiddenDanceCount = group.danceTypes.length - shownDanceTypes.length;

  const handleSchedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(isUngrouped ? "/lessons/new" : `/lessons/new?groupId=${group.id}`);
  };

  return (
    <div
      className={`grid ${GROUP_ROW_COLS} items-center px-3.5 py-3 lg:px-4.5 lg:py-3.5 border-b border-neutral-100 last:border-b-0 cursor-pointer hover:bg-neutral-50 transition-colors`}
      onClick={() => router.push(`/lessons/groups/${group.id}`)}
    >
      {/* 1 · 群組 */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-7.5 h-7.5 shrink-0 rounded-[9px] flex items-center justify-center ${
            isUngrouped ? "bg-neutral-200 text-neutral-500" : "bg-neutral-800 text-white"
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
        </div>
        <span
          className={`text-sm font-semibold truncate ${
            isUngrouped ? "text-neutral-600" : "text-neutral-900"
          }`}
        >
          {group.name}
        </span>
      </div>

      {/* 2–5 · phone: one wrapped meta line on the second row.
              lg: `contents` dissolves this wrapper so the four cells drop
              straight into their own table columns. */}
      <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:contents">
        <Cell className={group.danceTypes.length === 0 ? "max-lg:hidden" : ""}>
          {group.danceTypes.length === 0 ? (
            <span className="text-neutral-300">—</span>
          ) : (
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              {shownDanceTypes.map((type) => (
                <span
                  key={type}
                  className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${DANCE_TYPE_META[type].badge}`}
                >
                  {DANCE_TYPE_META[type].label}
                </span>
              ))}
              {hiddenDanceCount > 0 && (
                <span className="shrink-0 text-[11px] text-neutral-400">+{hiddenDanceCount}</span>
              )}
            </div>
          )}
        </Cell>

        <Cell label="課程">
          <span className={`tabular-nums ${isEmpty ? "text-neutral-400" : ""}`}>
            {group.lessonCount}
          </span>
        </Cell>

        <Cell label="學生">
          <span className={`tabular-nums ${group.studentCount === 0 ? "text-neutral-400" : ""}`}>
            {group.studentCount}
          </span>
        </Cell>

        {nextDate ? (
          <Cell label="下次">
            <span className="truncate">{formatNextSession(nextDate)}</span>
          </Cell>
        ) : (
          <Cell>
            <span className="text-neutral-400">尚未排課</span>
          </Cell>
        )}
      </div>

      {/* 6 · 狀態 — phone: pinned to the right of the first row via grid
             coordinates, so the DOM order (and tab order) never changes. */}
      <div className="col-start-2 row-start-1 lg:col-auto lg:row-auto flex items-center justify-end lg:justify-between gap-2 min-w-0">
        {hasDue ? (
          <span className="flex items-center gap-1.5 shrink-0 bg-warning-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full">
            <AlarmClock className="w-3.5 h-3.5" />
            {group.dueForAttendanceCount} 堂待點名
          </span>
        ) : isEmpty ? (
          <button
            onClick={handleSchedule}
            className="flex items-center gap-1 shrink-0 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-full transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            排課
          </button>
        ) : (
          <span />
        )}
        <ChevronRight className="hidden lg:block w-4 h-4 shrink-0 text-neutral-300" />
      </div>
    </div>
  );
};

export default GroupRow;
