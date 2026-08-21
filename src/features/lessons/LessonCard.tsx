"use client";

import { Users, CalendarDays, Copy, GraduationCap, AlarmClock, Check } from "lucide-react";
import { LessonSummary } from "@/store/slices/lessons";
import { format, addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { setLessonCloneSource } from "@/lib/lessonDraftStorage";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

const LessonCard = ({ lesson }: { lesson: LessonSummary }) => {
  const router = useRouter();
  const style = DANCE_TYPE_META[lesson.danceType];
  const isFinished = lesson.status === "finished";
  const hasDue = lesson.dueForAttendanceCount > 0 && lesson.dueForAttendancePeriodId !== null;

  // The single date the card highlights, by priority: overdue > finished > upcoming.
  const focusDateStr = hasDue
    ? lesson.dueForAttendanceDate
    : isFinished
    ? lesson.lastPeriodEnd
    : lesson.nextSessionDate;
  const focusDate = focusDateStr ? new Date(focusDateStr) : null;

  // Title often already carries the dance name ("下午 Salsa") — drop the badge then.
  const titleHasDance = lesson.name.toLowerCase().includes(style.label.toLowerCase());

  const attendancePct =
    lesson.totalPeriods > 0
      ? Math.round((lesson.attendedCount / lesson.totalPeriods) * 100)
      : 0;

  const handleClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const initialPeriod =
      lesson.lastPeriodStart && lesson.lastPeriodEnd
        ? {
            startTime: addDays(new Date(lesson.lastPeriodStart), 7).toISOString(),
            endTime: addDays(new Date(lesson.lastPeriodEnd), 7).toISOString(),
          }
        : undefined;
    setLessonCloneSource({
      lessonName: lesson.name,
      teacherIds: lesson.teachers.map((t) => t.id),
      cardIds: lesson.cardIds,
      danceType: lesson.danceType,
      groupId: lesson.groupId,
      initialPeriod,
    });
    router.push("/lessons/new");
  };

  const handleTakeAttendance = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/lessons/${lesson.id}/periods/${lesson.dueForAttendancePeriodId}/check`);
  };

  return (
    <div
      className={`group h-full cursor-pointer flex items-stretch gap-0 rounded-2xl border bg-white overflow-hidden hover:shadow-md transition-all duration-200 ${style.border}`}
      onClick={() => router.push(`/lessons/${lesson.id}`)}
    >
      {/* Dance-color accent stripe */}
      <div className={`w-1.5 shrink-0 ${style.bg}`} />

      <div className="flex flex-col gap-2.5 p-3.5 flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white shrink-0 leading-none ${style.bg}`}>
            {focusDate ? (
              <>
                <span className="text-[10px] font-medium opacity-90">{format(focusDate, "M")}月</span>
                <span className="text-lg font-bold">{format(focusDate, "d")}</span>
              </>
            ) : (
              <span className="font-bold text-lg">{lesson.name.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-neutral-900 leading-tight truncate">{lesson.name}</h4>
            {!titleHasDance && (
              <span className={`inline-flex mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
                {style.label}
              </span>
            )}
          </div>
          <button
            onClick={handleClone}
            className="p-1.5 text-neutral-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg shrink-0 transition-colors"
            aria-label="Clone lesson"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* Teacher row */}
        {lesson.teachers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{lesson.teachers.map((t) => t.name).join(", ")}</span>
          </div>
        )}

        {/* Stats row: students + attendance progress */}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <div className="flex items-center gap-1 shrink-0">
            <Users className="w-3.5 h-3.5" />
            <span>{lesson.studentCount}</span>
          </div>
          {lesson.totalPeriods > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="h-1.5 flex-1 rounded-full bg-neutral-200 overflow-hidden">
                <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${attendancePct}%` }} />
              </div>
              <span className="shrink-0 tabular-nums">{lesson.attendedCount}/{lesson.totalPeriods}</span>
            </div>
          )}
        </div>

        {/* Status-aware footer: actionable 點名 when due, otherwise an info pill. */}
        {hasDue ? (
          <button
            onClick={handleTakeAttendance}
            className="flex items-center justify-center gap-1.5 mt-auto w-full py-2 rounded-lg bg-warning-500 text-white text-sm font-semibold hover:bg-warning-600 transition-colors"
          >
            <AlarmClock className="w-4 h-4" />
            <span>
              {focusDate ? `${format(focusDate, "M月d日")} ` : ""}點名
              {lesson.dueForAttendanceCount > 1 ? ` · ${lesson.dueForAttendanceCount} 堂待點名` : ""}
            </span>
          </button>
        ) : (
          <div className="flex items-center justify-center gap-1.5 mt-auto w-full py-2 rounded-lg bg-neutral-100 text-neutral-500 text-sm font-medium">
            {isFinished ? (
              <>
                <Check className="w-4 h-4" />
                <span>{focusDate ? `${format(focusDate, "M月d日")} 已完成` : "已完成"}</span>
              </>
            ) : focusDate ? (
              <>
                <CalendarDays className="w-4 h-4" />
                <span>下次點名 {format(focusDate, "M月d日")}</span>
              </>
            ) : (
              <>
                <CalendarDays className="w-4 h-4" />
                <span>尚未排課</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonCard;
