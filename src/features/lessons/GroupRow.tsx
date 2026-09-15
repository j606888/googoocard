"use client";

import { AlarmClock, ChevronRight, Folder, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { format, isToday, isTomorrow } from "date-fns";
import { DanceType } from "@prisma/client";
import { DANCE_TYPE_META } from "@/lib/danceTypes";
import DataView, { DataViewColumn } from "@/components/DataView";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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

const formatNextSession = (date: Date) => {
  const time = format(date, "HH:mm");
  if (isToday(date)) return `今天 ${time}`;
  if (isTomorrow(date)) return `明天 ${time}`;
  return `${format(date, "M/d")}（${WEEKDAYS[date.getDay()]}）${time}`;
};

/**
 * 課程群組列表。欄位定義給 `DataView`，手機是卡片、桌面是表格，
 * 兩者共用同一份 DOM。
 */
const GroupTable = ({ groups }: { groups: GroupRowData[] }) => {
  const router = useRouter();

  const handleSchedule = (e: React.MouseEvent, group: GroupRowData) => {
    e.stopPropagation();
    router.push(
      group.id === "ungrouped"
        ? "/lessons/new"
        : `/lessons/new?groupId=${group.id}`
    );
  };

  const columns: DataViewColumn<GroupRowData>[] = [
    {
      key: "name",
      header: "群組",
      width: "minmax(0,2.2fr)",
      role: "primary",
      render: (group) => {
        const isUngrouped = group.id === "ungrouped";
        return (
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
        );
      },
    },
    {
      key: "danceTypes",
      header: "舞種",
      width: "132px",
      hideOnMobile: (group) => group.danceTypes.length === 0,
      render: (group) => {
        if (group.danceTypes.length === 0)
          return <span className="text-neutral-300">—</span>;
        const shown = group.danceTypes.slice(0, MAX_DANCE_BADGES);
        const hidden = group.danceTypes.length - shown.length;
        return (
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {shown.map((type) => (
              <span
                key={type}
                className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${DANCE_TYPE_META[type].badge}`}
              >
                {DANCE_TYPE_META[type].label}
              </span>
            ))}
            {hidden > 0 && (
              <span className="shrink-0 text-[11px] text-neutral-400">+{hidden}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "lessonCount",
      header: "課程",
      width: "64px",
      mobileLabel: "課程",
      render: (group) => (
        <span className={`tabular-nums ${group.lessonCount === 0 ? "text-neutral-400" : ""}`}>
          {group.lessonCount}
        </span>
      ),
    },
    {
      key: "studentCount",
      header: "學生",
      width: "64px",
      mobileLabel: "學生",
      render: (group) => (
        <span className={`tabular-nums ${group.studentCount === 0 ? "text-neutral-400" : ""}`}>
          {group.studentCount}
        </span>
      ),
    },
    {
      key: "nextSession",
      header: "下次上課",
      width: "140px",
      // 有排課才顯示「下次」小標；沒排課那格本身就是說明文字了。
      mobileLabel: undefined,
      render: (group) => {
        const nextDate = group.nextSessionDate ? new Date(group.nextSessionDate) : null;
        if (!nextDate) return <span className="text-neutral-400">尚未排課</span>;
        return (
          <>
            <span className="lg:hidden text-neutral-400 shrink-0">下次</span>
            <span className="truncate">{formatNextSession(nextDate)}</span>
          </>
        );
      },
    },
    {
      key: "status",
      header: "狀態",
      width: "168px",
      role: "trailing",
      render: (group) => (
        <>
          {group.dueForAttendanceCount > 0 ? (
            <span className="flex items-center gap-1.5 shrink-0 bg-warning-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full">
              <AlarmClock className="w-3.5 h-3.5" />
              {group.dueForAttendanceCount} 堂待點名
            </span>
          ) : group.lessonCount === 0 ? (
            <button
              onClick={(e) => handleSchedule(e, group)}
              className="flex items-center gap-1 shrink-0 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-full transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              排課
            </button>
          ) : (
            <span />
          )}
          <ChevronRight className="hidden lg:block w-4 h-4 shrink-0 text-neutral-300" />
        </>
      ),
    },
  ];

  return (
    <DataView
      columns={columns}
      rows={groups}
      rowKey={(group) => group.id}
      onRowClick={(group) => router.push(`/lessons/groups/${group.id}`)}
    />
  );
};

export default GroupTable;
