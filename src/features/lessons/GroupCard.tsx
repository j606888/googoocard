"use client";

import { AlarmClock, CalendarDays, ChevronRight, Folder } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { DanceType } from "@prisma/client";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export interface GroupCardData {
  /** "ungrouped" routes to the virtual 未分類 bucket instead of a real LessonGroup id. */
  id: number | "ungrouped";
  name: string;
  lessonCount: number;
  studentCount: number;
  danceTypes: DanceType[];
  dueForAttendanceCount: number;
  nextSessionDate: string | null;
}

const GroupCard = ({ group }: { group: GroupCardData }) => {
  const router = useRouter();
  const isUngrouped = group.id === "ungrouped";
  const hasDue = group.dueForAttendanceCount > 0;
  const nextDate = group.nextSessionDate ? new Date(group.nextSessionDate) : null;

  return (
    <div
      className={`flex flex-col gap-2.5 p-3.5 rounded-2xl border bg-white cursor-pointer hover:shadow-md transition-all duration-200 ${
        isUngrouped ? "border-dashed border-neutral-300 bg-neutral-50" : "border-neutral-200"
      }`}
      onClick={() => router.push(`/lessons/groups/${group.id}`)}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-white ${
            isUngrouped ? "bg-neutral-200 text-neutral-500" : "bg-neutral-800"
          }`}
        >
          <Folder className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={`font-semibold leading-tight truncate ${isUngrouped ? "text-neutral-600" : "text-neutral-900"}`}>
            {group.name}
          </h4>
          <div className="flex items-center gap-1.5 mt-1">
            {group.danceTypes.map((type) => (
              <span key={type} className={`w-1.5 h-1.5 rounded-full ${DANCE_TYPE_META[type].dot}`} />
            ))}
            <span className="text-xs text-neutral-500 ml-0.5">
              {group.lessonCount} 堂課{group.studentCount > 0 ? ` · ${group.studentCount} 位學生` : ""}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4.5 h-4.5 text-neutral-300 shrink-0" />
      </div>

      {hasDue ? (
        <div className="flex items-center gap-2 bg-warning-50 border border-warning-200 text-warning-900 rounded-lg px-2.5 py-2 text-sm font-semibold">
          <AlarmClock className="w-4 h-4" />
          今天 · {group.dueForAttendanceCount} 堂待點名
        </div>
      ) : nextDate ? (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <CalendarDays className="w-4 h-4" />
          下次上課 {format(nextDate, "M/d")}（{WEEKDAYS[nextDate.getDay()]}）
        </div>
      ) : null}
    </div>
  );
};

export default GroupCard;
