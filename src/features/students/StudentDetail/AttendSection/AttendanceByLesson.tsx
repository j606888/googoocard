import { StudentWithDetail } from "@/store/slices/students";
import { Frown, Smile } from "lucide-react";
import { formatDate } from "@/lib/utils";

const AttendanceByLesson = ({
  attendancesByLesson,
}: {
  attendancesByLesson: StudentWithDetail["attendancesByLesson"];
}) => {
  return (
    <div className="flex flex-col gap-2">
      {attendancesByLesson.map((lesson) => (
        <div key={lesson.lessonId}>
          <div className="flex justify-between items-center mb-2">
            <div className="text-base font-medium">{lesson.lessonName}</div>
            <div className="text-xs text-neutral-400">{lessonPeriod(lesson.studentAttendances)}</div>
          </div>
          <div className="flex gap-2 flex-wrap border-b border-neutral-200 pb-3">
            {lesson.studentAttendances.map((attendance) => (
              <div
                key={attendance.periodStartTime}
                className={`flex items-center gap-1 justify-center px-3 py-2 w-19 rounded-lg ${
                  attendance.periodAttendantCheck
                    ? attendance.studentAttend
                      ? "bg-primary-500"
                      : "bg-danger-400"
                    : "border border-neutral-200"
                }`}
              >
                {attendance.periodAttendantCheck &&
                  (attendance.studentAttend ? (
                    <Smile className="w-4 h-4 text-white" />
                  ) : (
                    <Frown className="w-4 h-4 text-white" />
                  ))}
                <span
                  className={`text-xs text-center ${
                    attendance.periodAttendantCheck
                      ? "text-white"
                      : "text-neutral-700"
                  }`}
                >
                  {formatDate(attendance.periodStartTime, "MM/dd")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

function lessonPeriod(studentAttendances: { periodId: number, periodStartTime: string, studentAttend: boolean }[]) {
  if (!Array.isArray(studentAttendances) || studentAttendances.length === 0) {
    return "";
  }

  const times = studentAttendances.map((item) => new Date(item.periodStartTime));

  const minDate = Math.min(...times.map((time) => time.getTime()));
  const maxDate = Math.max(...times.map((time) => time.getTime()));

  return `${formatDate(minDate, "yyyy/MM/dd")} - ${formatDate(maxDate, "yyyy/MM/dd")}`;
}

export default AttendanceByLesson;
