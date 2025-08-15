import { Users, BookOpenText, Flag, Dot } from "lucide-react";
import { Lesson } from "@/store/slices/lessons";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

const LessonCard = ({ lesson }: { lesson: Lesson }) => {
  const router = useRouter();
  const attendCount = lesson.periods.filter((period) => period.attendanceTakenAt).length;
  const lastPeriod = lesson.periods.reduce((latest, period) => {
    return new Date(period.endTime) > new Date(latest.endTime) ? period : latest;
  })
  
  return <div className="flex gap-3 cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/lessons/${lesson.id}`)}>
    <div className="flex items-center justify-center w-12 h-12 bg-primary-500 text-white font-semibold text-2xl">{lesson.name.charAt(0)}</div>
    <div className="flex flex-col justify-center">
      <h4 className="font-medium text-sm">{lesson.name}</h4>
      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{lesson.students.length}</span>
        </div>
        <Dot className="w-2 h-2" />
        <div className="flex items-center gap-1">
          <BookOpenText className="w-3 h-3" />
          <span>{attendCount} of {lesson.periods.length}</span>
        </div>
        <Dot className="w-2 h-2" />
        <div className="flex items-center gap-1">
          <Flag className="w-3 h-3" />
          <span>{format(new Date(lastPeriod.endTime), "yyyy/MM/dd")} End</span>
        </div>
      </div>
    </div>
  </div>;
};

export default LessonCard;