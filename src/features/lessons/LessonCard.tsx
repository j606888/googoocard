"use client";

import { Users, BookOpenText, Flag, CalendarDays, Copy, GraduationCap, AlarmClock } from "lucide-react";
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
      className={`group cursor-pointer flex items-stretch gap-0 rounded-2xl border bg-white overflow-hidden hover:shadow-md transition-all duration-200 ${
        hasDue
          ? "border-warning-400 ring-1 ring-warning-200"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
      onClick={() => router.push(`/lessons/${lesson.id}`)}
    >
      {/* Dance-color accent stripe */}
      <div className={`w-1.5 shrink-0 ${style.bg}`} />

      <div className="flex flex-col gap-2.5 p-3.5 flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${style.bg}`}>
            {lesson.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-neutral-900 leading-tight truncate">{lesson.name}</h4>
            <span className={`inline-flex mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
              {style.label}
            </span>
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

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{lesson.studentCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpenText className="w-3.5 h-3.5" />
            <span>{lesson.attendedCount}/{lesson.totalPeriods}</span>
          </div>
          {!isFinished && lesson.nextSessionDate && (
            <div className="flex items-center gap-1 ml-auto font-medium text-primary-600">
              <Flag className="w-3 h-3" />
              <span>Next {format(new Date(lesson.nextSessionDate), "M/d")}</span>
            </div>
          )}
          {isFinished && lesson.lastPeriodEnd && (
            <div className="flex items-center gap-1 ml-auto text-neutral-400">
              <CalendarDays className="w-3 h-3" />
              <span>Ended {format(new Date(lesson.lastPeriodEnd), "M/d")}</span>
            </div>
          )}
        </div>

        {/* Due-for-attendance CTA */}
        {hasDue && (
          <button
            onClick={handleTakeAttendance}
            className="flex items-center justify-center gap-1.5 mt-0.5 w-full py-2 rounded-lg bg-warning-500 text-white text-sm font-semibold hover:bg-warning-600 transition-colors"
          >
            <AlarmClock className="w-4 h-4" />
            <span>
              點名
              {lesson.dueForAttendanceCount > 1 ? ` · ${lesson.dueForAttendanceCount} 堂待點名` : ""}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default LessonCard;
