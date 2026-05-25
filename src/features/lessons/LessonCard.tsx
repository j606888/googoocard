import { Users, BookOpenText, Flag, Dot, Copy } from "lucide-react";
import { Lesson } from "@/store/slices/lessons";
import { format, addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { setLessonCloneSource } from "@/lib/lessonDraftStorage";

const LessonCard = ({ lesson }: { lesson: Lesson }) => {
  const router = useRouter();
  const periods = lesson.periods || []
  const attendCount = periods.filter((period) => period.attendanceTakenAt).length;
  const lastPeriod = periods.reduce((latest, period) => {
    return new Date(period.endTime) > new Date(latest.endTime) ? period : latest;
  }, periods[0])

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

  return <div className="flex gap-3 cursor-pointer hover:bg-gray-50 items-center" onClick={() => router.push(`/lessons/${lesson.id}`)}>
    <div className="flex items-center justify-center w-12 h-12 bg-primary-500 text-white font-semibold text-2xl shrink-0">{lesson.name.charAt(0)}</div>
    <div className="flex flex-col justify-center flex-1 min-w-0">
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
      className="p-2 text-gray-400 hover:text-primary-500 shrink-0"
    >
      <Copy className="w-4 h-4" />
    </button>
  </div>;
};

export default LessonCard;