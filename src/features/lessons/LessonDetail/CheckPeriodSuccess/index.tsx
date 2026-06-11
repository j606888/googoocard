import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Clock } from "lucide-react";
import SubNavbar from "@/features/SubNavbar";
import { PulseLoader } from "react-spinners";
import { format } from "date-fns";
import {
  useGetAttendanceQuery,
  useGetLessonQuery,
} from "@/store/slices/lessons";
import { periodInfo } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import StudentInfo from "@/components/StudentInfo";
import PendingStudents from "./PendingStudents";

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

  const pendingRecords =
    attendanceRecords?.filter((record) => !record.income) || [];
  const paidRecords =
    attendanceRecords?.filter((record) => record.income) || [];

  if (!attendanceRecords || !lesson) {
    return (
      <>
        <SubNavbar title={lesson?.name || ""} backUrl={`/lessons/${id}`} />
        <div className="h-[calc(100vh-64px)] flex items-center justify-center">
          <PulseLoader color="#55BD95" size={20} />
        </div>
      </>
    );
  }

  return (
    <>
      <SubNavbar title={lesson?.name || ""} backUrl={`/lessons/${id}`} />
      <div className="px-5 py-6 flex flex-col items-center gap-5 max-w-md mx-auto w-full">
        <div className="flex justify-center items-center rounded-full bg-primary-100 w-20 h-20 ring-8 ring-primary-50">
          <Check className="w-11 h-11 text-primary-600" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h3 className="text-lg font-bold text-gray-900">課程簽到成功</h3>
          <p className="text-sm text-gray-500">{formattedNow}</p>
        </div>
        <div className="flex items-center justify-between w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl">
          <p className="font-medium text-gray-900">{date}</p>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>
              {startHour} ~ {endHour}
            </span>
          </div>
        </div>
        {pendingRecords.length > 0 && (
          <PendingStudents records={pendingRecords} lesson={lesson} />
        )}
        <div className="flex items-center justify-between w-full">
          <p className="text-sm font-medium text-gray-700">Show income</p>
          <Switch checked={showIncome} onCheckedChange={setShowIncome} />
        </div>
        <div className="flex flex-col gap-2 w-full mb-4">
          {paidRecords?.map((attendanceRecord) => (
            <div
              className="flex gap-2 items-center"
              key={attendanceRecord.studentId}
            >
              <StudentInfo
                studentId={attendanceRecord.studentId}
                avatarUrl={attendanceRecord?.studentAvatarUrl}
                name={attendanceRecord?.studentName}
                size="small"
                className="mr-auto"
              />
              <div className="px-3 py-1 bg-primary-50 rounded-full border border-primary-200 text-xs font-medium text-primary-700">
                {attendanceRecord?.cardName}
              </div>
              <div className="text-sm text-gray-600 w-24 text-right">
                {showIncome ? (
                  <span className="font-semibold text-gray-900">${Math.round(attendanceRecord?.income)}</span>
                ) : (
                  <span>
                    {attendanceRecord?.remainingSessions} left
                  </span>
                )}
              </div>
            </div>
          ))}
          {showIncome && (
            <div className="flex justify-between w-full px-3 py-2.5 bg-primary-50 rounded-xl mt-2">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-sm font-bold text-primary-700">
                $
                {Math.round(
                  paidRecords?.reduce((acc, record) => acc + record.income, 0)
                )}
              </span>
            </div>
          )}
        </div>
        <Link href={`/lessons/${id}`} className="w-full">
          <button
            className="bg-primary-500 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 mb-4 w-full cursor-pointer hover:bg-primary-600 font-semibold shadow-[0_6px_18px_-6px_rgba(43,142,110,0.7)] transition-colors"
          >
            <span>Back to Lesson</span>
          </button>
        </Link>
      </div>
    </>
  );
};

export default CheckPeriodSuccess;
