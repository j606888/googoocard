"use client";

import { Users, BookOpenText, Flag, CalendarDays, Dot, Copy, GraduationCap } from "lucide-react";
import { Lesson } from "@/store/slices/lessons";
import { format, addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { setLessonCloneSource } from "@/lib/lessonDraftStorage";
import { DANCE_TYPE_STYLES } from "./danceTypeStyles";

const LessonCard = ({ lesson }: { lesson: Lesson }) => {
  const router = useRouter();
  const periods = lesson.periods || [];
  const attendCount = periods.filter((period) => period.attendanceTakenAt).length;
  const lastPeriod = periods.reduce(
    (latest, period) =>
      new Date(period.endTime) > new Date(latest.endTime) ? period : latest,
    periods[0]
  );
  const nextPendingPeriod = [...periods]
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .find((p) => !p.attendanceTakenAt);

  const style = DANCE_TYPE_STYLES[lesson.danceType];
  const isFinished = periods.length > 0 && attendCount === periods.length;

  const handleClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const initialPeriod = lastPeriod
      ? {
          startTime: addDays(new Date(lastPeriod.startTime), 7).toISOString(),
          endTime: addDays(new Date(lastPeriod.endTime), 7).toISOString(),
        }
      : undefined;
    setLessonCloneSource({
      lessonName: lesson.name,
      teacherIds: lesson.teachers.map((t) => t.id),
      cardIds: lesson.cards.map((c) => c.id),
      danceType: lesson.danceType,
      initialPeriod,
    });
    router.push("/lessons/new");
  };

  return (
    <div
      className="cursor-pointer hover:bg-gray-50 items-center flex gap-3
        lg:flex-col lg:items-stretch lg:gap-0 lg:border lg:border-gray-200 lg:rounded-xl lg:overflow-hidden lg:hover:shadow-md lg:hover:border-gray-300 lg:transition-all lg:duration-200 lg:bg-white lg:hover:bg-white"
      onClick={() => router.push(`/lessons/${lesson.id}`)}
    >
      {/* Desktop: colored top stripe */}
      <div className={`hidden lg:block h-1.5 w-full ${style.bg}`} />

      {/* Desktop: card body */}
      <div className="hidden lg:flex lg:flex-col lg:gap-3 lg:p-4 lg:flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0 ${style.bg}`}>
              {lesson.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-gray-900 text-sm leading-tight">{lesson.name}</h4>
              <span className={`inline-flex mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
                {lesson.danceType}
              </span>
            </div>
          </div>
          <button
            onClick={handleClone}
            className="p-1.5 text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg shrink-0 transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* Teacher row */}
        {lesson.teachers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{lesson.teachers.map((t) => t.name).join(", ")}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{lesson.students.length} students</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpenText className="w-3.5 h-3.5" />
            <span>{attendCount}/{periods.length} periods</span>
          </div>
          {nextPendingPeriod && (
            <div className="flex items-center gap-1 ml-auto text-primary-600">
              <Flag className="w-3 h-3" />
              <span>Next: {format(new Date(nextPendingPeriod.startTime), "M/d")}</span>
            </div>
          )}
          {isFinished && lastPeriod && (
            <div className="flex items-center gap-1 ml-auto text-gray-400">
              <CalendarDays className="w-3 h-3" />
              <span>Ended {format(new Date(lastPeriod.endTime), "M/d")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: original compact layout */}
      <div className={`lg:hidden w-12 h-12 flex items-center justify-center text-white font-semibold text-2xl shrink-0 ${style.bg}`}>
        {lesson.name.charAt(0)}
      </div>
      <div className="lg:hidden flex flex-col justify-center flex-1 min-w-0">
        <h4 className="font-medium text-sm">{lesson.name}</h4>
        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{lesson.students.length}</span>
          </div>
          <Dot className="w-2 h-2" />
          <div className="flex items-center gap-1">
            <BookOpenText className="w-3 h-3" />
            <span>{attendCount} of {periods.length}</span>
          </div>
          <Dot className="w-2 h-2" />
          <div className="flex items-center gap-1">
            <Flag className="w-3 h-3" />
            {lastPeriod && (
              <span>{format(new Date(lastPeriod.endTime), "yyyy/MM/dd")} End</span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={handleClone}
        className="lg:hidden p-2 text-gray-400 hover:text-primary-500 shrink-0"
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
};

export default LessonCard;
