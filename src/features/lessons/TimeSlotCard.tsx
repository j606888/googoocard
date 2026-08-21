"use client";

import { AlarmClock, Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { LessonSummary } from "@/store/slices/lessons";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

// Compact, time-first row for browsing a group's slots on one day — as
// opposed to LessonCard's date-first grid tile used in the flat/search list.
const TimeSlotCard = ({ lesson }: { lesson: LessonSummary }) => {
  const router = useRouter();
  const style = DANCE_TYPE_META[lesson.danceType];
  const hasDue = lesson.dueForAttendanceCount > 0 && lesson.dueForAttendancePeriodId !== null;
  const isFinished = lesson.status === "finished";
  const titleHasDance = lesson.name.toLowerCase().includes(style.label.toLowerCase());

  // The slot's clock time, by priority: due today > next upcoming > last taught.
  const start = hasDue
    ? lesson.dueForAttendanceDate
    : lesson.nextSessionDate ?? lesson.lastPeriodStart;
  const end = hasDue
    ? lesson.dueForAttendanceEndTime
    : lesson.nextSessionEndTime ?? lesson.lastPeriodEnd;

  const handleTakeAttendance = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/lessons/${lesson.id}/periods/${lesson.dueForAttendancePeriodId}/check`);
  };

  return (
    <div
      className="flex items-stretch rounded-2xl border border-neutral-200 bg-white overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200"
      onClick={() => router.push(`/lessons/${lesson.id}`)}
    >
      <div className={`w-1.5 shrink-0 ${style.bg}`} />
      <div className="flex flex-col gap-2 p-3.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {start && (
              <span className="text-[13px] font-bold text-neutral-700 tabular-nums shrink-0">
                {format(new Date(start), "HH:mm")}
                {end ? `–${format(new Date(end), "HH:mm")}` : ""}
              </span>
            )}
            <span className="font-semibold text-neutral-900 truncate">{lesson.name}</span>
          </div>
          {!titleHasDance && (
            <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
              {style.label}
            </span>
          )}
        </div>

        {lesson.teachers.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>{lesson.teachers.map((t) => t.name).join(", ")}</span>
            <span>{lesson.studentCount} 人</span>
          </div>
        )}

        {hasDue ? (
          <button
            onClick={handleTakeAttendance}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-warning-500 text-white text-sm font-semibold hover:bg-warning-600 transition-colors"
          >
            <AlarmClock className="w-4 h-4" />
            待點名
          </button>
        ) : isFinished ? (
          <div className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-primary-50 text-primary-700 text-sm font-medium">
            <Check className="w-4 h-4" />
            已點名{lesson.attendedCount > 0 ? ` · ${lesson.attendedCount} 堂` : ""}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-neutral-100 text-neutral-500 text-sm font-medium">
            <Clock className="w-4 h-4" />
            尚未開始
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeSlotCard;
