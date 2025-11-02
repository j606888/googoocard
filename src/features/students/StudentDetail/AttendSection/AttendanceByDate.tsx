import { StudentWithDetail } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { MdFlag } from "react-icons/md";

const AttendanceByDate = ({
  attendancesByDate,
}: {
  attendancesByDate: StudentWithDetail["attendancesByDate"];
}) => {
  return (
    <div className="flex flex-col gap-3">
      {attendancesByDate.map((attendances) => (
        <div
          key={attendances.date}
          className="rounded-sm bg-white shadow-sm overflow-hidden"
        >
          <div className="px-3 py-2 bg-primary-500 text-white font-medium">
            {formatDate(attendances.date)}
          </div>
          <div className="flex flex-col py-2">
            {attendances.attendances.map((attendance) => (
              <div
                key={attendance.lessonName}
                className="flex items-center justify-between px-3 py-1"
              >
                <span className="text-sm">{attendance.lessonName}</span>
                <div className="bg-primary-100 text-primary-700 px-2 py-1 rounded-sm text-sm flex items-center gap-1">
                  <span>
                    {attendance.periodNumber}/{attendance.totalPeriods}
                  </span>
                  {attendance.periodNumber === attendance.totalPeriods && (
                    <MdFlag className="w-4 h-4" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AttendanceByDate;
