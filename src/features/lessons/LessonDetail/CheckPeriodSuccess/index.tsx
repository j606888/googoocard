import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Check, Clock, PencilLine } from "lucide-react";
import SubNavbar from "@/features/SubNavbar";
import { PulseLoader } from "react-spinners";
import { format } from "date-fns";
import {
  useGetAttendanceQuery,
  useGetLessonQuery,
  useGetLessonStudentsQuery,
} from "@/store/slices/lessons";
import { periodInfo } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import StudentInfo from "@/components/StudentInfo";
import PendingStudents from "./PendingStudents";

const CheckPeriodSuccess = () => {
  const [showIncome, setShowIncome] = useState(false);
  const { id, periodId } = useParams();
  const searchParams = useSearchParams();
  // Present only right after CheckPeriod/EditPeriod submit — distinguishes
  // that celebratory moment from browsing back to this same record later
  // (period timeline, unpaid bell, income calendar all link here plainly).
  const justSubmitted = searchParams.get("justSubmitted") === "1";

  const { data: attendanceRecords } = useGetAttendanceQuery({
    id: Number(id),
    periodId: Number(periodId),
  });
  const { data: lesson } = useGetLessonQuery(id as string);
  const { data: rosterStudents } = useGetLessonStudentsQuery({ id: Number(id) });
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

  // Enrolled students the roster marks absent for this exact period — visible
  // here for the first time (the old success screen only ever listed who
  // attended).
  const absentStudents = useMemo(() => {
    if (!period || !rosterStudents) return [];
    return rosterStudents.filter((student) =>
      student.attendances.some(
        (a) => a.startTime === period.startTime && a.attendanceStatus === "absent"
      )
    );
  }, [period, rosterStudents]);

  // Editing here is only offered for the most recently taken period — same
  // rule PeriodSection's timeline uses, so retroactively editing an old
  // period (and its card deductions) stays a deliberate, rare action.
  const lastAttendPeriodId = lesson?.periods
    .filter((p) => p.attendanceTakenAt)
    .at(-1)?.id;
  const isLastAttend = period?.id === lastAttendPeriodId;

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
        {justSubmitted ? (
          <>
            <div className="flex justify-center items-center rounded-full bg-primary-100 w-20 h-20 ring-8 ring-primary-50">
              <Check className="w-11 h-11 text-primary-600" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <h3 className="text-lg font-bold text-neutral-900">課程簽到成功</h3>
              <p className="text-sm text-neutral-500">{formattedNow}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <h3 className="text-lg font-bold text-neutral-900">點名紀錄</h3>
            {formattedNow && <p className="text-sm text-neutral-500">{formattedNow} 完成點名</p>}
          </div>
        )}

        <div className="flex items-center justify-between w-full bg-neutral-50 border border-neutral-200 px-4 py-3 rounded-2xl">
          <p className="font-medium text-neutral-900">{date}</p>
          <div className="flex items-center gap-1.5 text-sm text-neutral-600">
            <Clock className="w-4 h-4" />
            <span>
              {startHour} ~ {endHour}
            </span>
          </div>
        </div>

        {/* Status summary: attended (present, whether or not their card is
            resolved yet) / absent / pending resolution */}
        <div className="flex gap-2 w-full">
          <div className="flex-1 flex flex-col items-center gap-0.5 bg-primary-50 rounded-xl py-2.5">
            <span className="text-lg font-bold text-primary-700">{attendanceRecords.length}</span>
            <span className="text-[11px] text-primary-700">出席</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-0.5 bg-danger-50 rounded-xl py-2.5">
            <span className="text-lg font-bold text-danger-600">{absentStudents.length}</span>
            <span className="text-[11px] text-danger-600">缺席</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-0.5 bg-neutral-100 rounded-xl py-2.5">
            <span className="text-lg font-bold text-neutral-600">{pendingRecords.length}</span>
            <span className="text-[11px] text-neutral-600">待處理</span>
          </div>
        </div>

        {pendingRecords.length > 0 && (
          <PendingStudents records={pendingRecords} lesson={lesson} />
        )}
        <div className="flex items-center justify-between w-full">
          <p className="text-sm font-medium text-neutral-700">顯示收入</p>
          <Switch checked={showIncome} onCheckedChange={setShowIncome} />
        </div>
        <div className="flex flex-col gap-2 w-full">
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
              <div className="text-sm text-neutral-600 w-24 text-right">
                {showIncome ? (
                  <span className="font-semibold text-neutral-900">${Math.round(attendanceRecord?.income)}</span>
                ) : (
                  <span>
                    剩 {attendanceRecord?.remainingSessions} 堂
                  </span>
                )}
              </div>
            </div>
          ))}
          {showIncome && (
            <div className="flex justify-between w-full px-3 py-2.5 bg-primary-50 rounded-xl mt-2">
              <span className="text-sm font-semibold text-neutral-700">合計</span>
              <span className="text-sm font-bold text-primary-700">
                $
                {Math.round(
                  paidRecords?.reduce((acc, record) => acc + record.income, 0)
                )}
              </span>
            </div>
          )}
        </div>

        {absentStudents.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {absentStudents.map((student) => (
              <div className="flex gap-2 items-center opacity-60" key={student.id}>
                <StudentInfo
                  studentId={student.id}
                  avatarUrl={student.avatarUrl}
                  name={student.name}
                  size="small"
                  className="mr-auto"
                />
                <div className="px-3 py-1 bg-danger-50 rounded-full border border-danger-200 text-xs font-medium text-danger-600">
                  缺席
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5 w-full mt-2">
          {isLastAttend && (
            <Link href={`/lessons/${id}/periods/${periodId}/check-edit`} className="w-full">
              <button className="border border-neutral-200 text-neutral-700 px-4 py-3 rounded-xl flex items-center justify-center gap-2 w-full cursor-pointer hover:bg-neutral-50 font-semibold transition-colors">
                <PencilLine className="w-4 h-4" />
                <span>編輯點名</span>
              </button>
            </Link>
          )}
          <Link href={`/lessons/${id}`} className="w-full">
            <button
              className="bg-primary-500 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 w-full cursor-pointer hover:bg-primary-600 font-semibold shadow-[0_6px_18px_-6px_rgba(43,142,110,0.7)] transition-colors"
            >
              <span>回到課程</span>
            </button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default CheckPeriodSuccess;
