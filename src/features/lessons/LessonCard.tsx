"use client";

import { Users, BookOpenText, Flag, CalendarDays, Copy, GraduationCap } from "lucide-react";
import { Lesson } from "@/store/slices/lessons";
import { format, addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { setLessonCloneSource } from "@/lib/lessonDraftStorage";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

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

  const style = DANCE_TYPE_META[lesson.danceType];
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
      className="group cursor-pointer flex items-stretch gap-0 rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:border-gray-300 transition-all duration-200"
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
            <h4 className="font-semibold text-gray-900 leading-tight truncate">{lesson.name}</h4>
            <span className={`inline-flex mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
              {style.label}
            </span>
          </div>
          <button
            onClick={handleClone}
            className="p-1.5 text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg shrink-0 transition-colors"
            aria-label="Clone lesson"
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
            <span>{lesson.students.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpenText className="w-3.5 h-3.5" />
            <span>{attendCount}/{periods.length}</span>
          </div>
          {nextPendingPeriod && (
            <div className="flex items-center gap-1 ml-auto font-medium text-primary-600">
              <Flag className="w-3 h-3" />
              <span>Next {format(new Date(nextPendingPeriod.startTime), "M/d")}</span>
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
    </div>
  );
};

export default LessonCard;
