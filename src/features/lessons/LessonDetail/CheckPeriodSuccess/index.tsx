import SubNavbar from "@/features/SubNavbar";
import { useParams } from "next/navigation";
import {
  useGetAttendanceQuery,
  useGetLessonQuery,
} from "@/store/slices/lessons";
import { Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { periodInfo } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import StudentInfo from "@/components/StudentInfo";
import Link from "next/link";
import { useState } from "react";

const CheckPeriodSuccess = () => {
  const [showIncome, setShowIncome] = useState(false);
  const { id, periodId } = useParams();
  const { data: attendanceRecords } = useGetAttendanceQuery({
    id: Number(id),
    periodId: Number(periodId),
  });
  const { data: lesson } = useGetLessonQuery(id as string);
  const period = lesson?.periods.find(
    (period) => period.id === Number(periodId)
  );
  const { date, startHour, endHour } = periodInfo(period);
  const formattedNow =
    period?.attendanceTakenAt &&
    format(period?.attendanceTakenAt, "yyyy/MM/dd, hh:mm a");

  if (!attendanceRecords) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <SubNavbar title={lesson?.name || ""} />
      <div className="px-5 py-5 flex flex-col items-center gap-5">
        <div className="flex justify-center items-center rounded-full bg-primary-50 w-24 h-24">
          <Check className="w-14 h-14 text-primary-500" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h3 className="text-lg font-bold">Take Attendance Success</h3>
          <p className="text-sm text-[#777777]">{formattedNow}</p>
        </div>
        <div className="flex flex-col w-full items-baseline gap-1 border-1 border-primary-900 bg-primary-50 px-4 py-3 rounded-sm">
          <p className="font-medium">{date}</p>
          <div className="flex items-center gap-1 text-sm text-[#444444]">
            <Clock className="w-4 h-4" />
            <span>
              {startHour} ~ {endHour}
            </span>
          </div>
        </div>
        <div className="flex justify-between w-full">
          <p className="text-sm font-medium">Show income</p>
          <Switch checked={showIncome} onCheckedChange={setShowIncome} />
        </div>
        <div className="flex flex-col gap-2 w-full mb-4">
          {attendanceRecords?.map((attendanceRecord) => (
            <div
              className="flex gap-2 items-center"
              key={attendanceRecord.studentId}
            >
              <StudentInfo
                avatarUrl={attendanceRecord?.studentAvatarUrl}
                name={attendanceRecord?.studentName}
                size="small"
                className="mr-auto"
              />
              <div className="px-3 py-1.5 bg-primary-50 rounded-sm border border-primary-500 text-sm font-medium text-primary-700">
                {attendanceRecord?.cardName}
              </div>
              <div className="text-sm text-[#555555] w-25 text-right">
                {showIncome ? (
                  <span>${Math.round(attendanceRecord?.income)}</span>
                ) : (
                  <span>
                    {attendanceRecord?.remainingSessions} sessons left
                  </span>
                )}
              </div>
            </div>
          ))}
          {showIncome && (
            <div className="flex justify-between w-full p-2 bg-primary-50 rounded-sm mt-2">
              <span className="text-sm font-medium">Total</span>
              <span className="text-sm font-medium">
                $
                {Math.round(
                  attendanceRecords?.reduce(
                    (acc, record) => acc + record.income,
                    0
                  )
                )}
              </span>
            </div>
          )}
        </div>
        <Link href={`/lessons/${id}`} className="w-full">
          <button
            className={`bg-primary-500 text-white px-4 py-2 rounded-sm flex items-center justify-center gap-2 mb-4 w-full cursor-pointer hover:bg-primary-600`}
          >
            <span className="font-medium">Back to Lessons</span>
          </button>
        </Link>
      </div>
    </>
  );
};

export default CheckPeriodSuccess;
