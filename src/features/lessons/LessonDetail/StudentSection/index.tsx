import { LessonStudent } from "@/store/slices/lessons";
import Image from "next/image";
import { format } from "date-fns";
import { Frown, Smile } from "lucide-react";

const StudentSection = ({ students }: { students: LessonStudent[] }) => {
  return (
    <div className="flex flex-col gap-3 px-5">
      <div className="flex flex-col ">
        {students.map((student) => (
          <div
            key={student.id}
            className="flex flex-col items-start gap-2 py-3 border-b border-gray-200"
          >
            <div className="flex items-center gap-2">
              <Image
                src={student.avatarUrl}
                alt={student.name}
                width={40}
                height={40}
                className="rounded-full"
              />
              <p className="text-lg font-semibold">{student.name}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {student.attendances.map((attendance) => (
                <Round key={attendance.startTime} attendance={attendance} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-md text-sm font-bold">
        Invite Student
      </button>
    </div>
  );
};

const BADGE_STYLES = {
  attended: "bg-primary-500 text-white",
  absent: "bg-gray-400 text-white",
  not_started: "border border-gray-200 text-[#777777]",
};
const Round = ({
  attendance,
}: {
  attendance: {
    startTime: string;
    attendanceStatus: "not_started" | "attended" | "absent";
  };
}) => {
  const date = new Date(attendance.startTime);

  return (
    <div
      className={`flex gap-1 items-center justify-center rounded-full text-xs font-semibold px-3 py-2 w-17 ${
        BADGE_STYLES[attendance.attendanceStatus]
      }`}
    >
      {attendance.attendanceStatus === "attended" && (
        <Smile className="w-4 h-4" />
      )}
      {attendance.attendanceStatus === "absent" && (
        <Frown className="w-4 h-4" />
      )}
      {format(date, "M/dd")}
    </div>
  );
};

export default StudentSection;
