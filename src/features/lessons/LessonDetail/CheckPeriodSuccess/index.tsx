import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Check, Clock, PencilLine } from "lucide-react";
import SubNavbar from "@/features/SubNavbar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  type AttendanceRecord,
  useGetAttendanceQuery,
  useGetLessonQuery,
  useGetLessonStudentsQuery,
} from "@/store/slices/lessons";
import { periodInfo } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import StudentInfo from "@/components/StudentInfo";
import PendingStudents from "./PendingStudents";
import DayCollections from "./DayCollections";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { formatMoney } from "@/lib/money";
import { ConfirmDropInForm } from "./DropInForm";

const CheckPeriodSuccess = () => {
  const [showIncome, setShowIncome] = useState(false);
  const isExpanded = useSizeClass() === "expanded";
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
  const { data: rosterStudents, isLoading: isRosterLoading } =
    useGetLessonStudentsQuery({ id: Number(id) });
  const period = lesson?.periods.find(
    (period) => period.id === Number(periodId)
  );
  const { date, startHour, endHour } = periodInfo(period);
  const formattedNow =
    period?.attendanceTakenAt &&
    format(period?.attendanceTakenAt, "yyyy/MM/dd, hh:mm a");

  // 已解決 = 扣了卡或付了單堂（$0 的體驗卡 income 是 0，不能拿 income 判斷）。
  const isResolved = (record: AttendanceRecord) => Boolean(record.cardName || record.dropIn);
  const pendingRecords = attendanceRecords?.filter((record) => !isResolved(record)) || [];
  const paidRecords = attendanceRecords?.filter(isResolved) || [];

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

  // 名冊也要等：不然「缺席」先顯示 0、缺席名單晚一拍才跳出來。
  if (!attendanceRecords || !lesson || isRosterLoading) {
    return (
      <>
        {!isExpanded && (
          <SubNavbar title={lesson?.name || ""} backUrl={`/lessons/${id}`} />
        )}
        <div className="px-5 py-6 lg:px-8 flex flex-col items-center gap-5 max-w-md lg:max-w-3xl mx-auto lg:mx-0 w-full">
          {justSubmitted ? (
            <>
              <div className="flex justify-center items-center rounded-full bg-primary-100 w-20 h-20 ring-8 ring-primary-50">
                <Check className="w-11 h-11 text-primary-700" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-lg font-bold text-neutral-900">課程簽到成功</h3>
                <Skeleton className="h-4 w-36" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <h3 className="text-lg font-bold text-neutral-900">點名紀錄</h3>
              <Skeleton className="h-4 w-44" />
            </div>
          )}

          <Skeleton className="h-12 w-full rounded-2xl" />

          <div className="flex gap-2 w-full">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="flex-1 h-[58px] rounded-xl" />
            ))}
          </div>

          <div className="flex flex-col gap-3 w-full">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="flex gap-2 items-center" key={index}>
                <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                <Skeleton className="h-5 w-24 mr-auto" />
                <Skeleton className="h-5.5 w-20" />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 w-full mt-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {!isExpanded && (
        <SubNavbar title={lesson?.name || ""} backUrl={`/lessons/${id}`} />
      )}
      {/* 手機維持窄欄；桌面放寬到 3xl——1920px 上不該還是手機寬，
          但點名結果是一份逐列的清單，全寬拉開反而難讀。 */}
      <div className="px-5 py-6 lg:px-8 flex flex-col items-center gap-5 max-w-md lg:max-w-3xl mx-auto lg:mx-0 w-full">
        {justSubmitted ? (
          <>
            <div className="flex justify-center items-center rounded-full bg-primary-100 w-20 h-20 ring-8 ring-primary-50">
              <Check className="w-11 h-11 text-primary-700" strokeWidth={2.5} />
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
            <span className="text-lg font-bold text-primary-900">{attendanceRecords.length}</span>
            <span className="text-xs text-primary-900">出席</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-0.5 bg-danger-50 rounded-xl py-2.5">
            <span className="text-lg font-bold text-danger-700">{absentStudents.length}</span>
            <span className="text-xs text-danger-700">缺席</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-0.5 bg-neutral-100 rounded-xl py-2.5">
            <span className="text-lg font-bold text-neutral-600">{pendingRecords.length}</span>
            <span className="text-xs text-neutral-600">待處理</span>
          </div>
        </div>

        {pendingRecords.length > 0 && (
          <PendingStudents records={pendingRecords} lesson={lesson} periodId={Number(periodId)} />
        )}
        <div className="flex items-center justify-between w-full">
          <p className="text-sm font-medium text-neutral-700">顯示收入</p>
          <Switch checked={showIncome} onCheckedChange={setShowIncome} />
        </div>
        <div className="flex flex-col gap-2 w-full">
          {paidRecords?.map((attendanceRecord) => (
            <div
              className="flex flex-wrap gap-2 items-center"
              key={attendanceRecord.studentId}
            >
              <StudentInfo
                studentId={attendanceRecord.studentId}
                avatarUrl={attendanceRecord?.studentAvatarUrl}
                name={attendanceRecord?.studentName}
                size="small"
                className="mr-auto"
              />
              {attendanceRecord.dropIn ? (
                <DropInStatus dropIn={attendanceRecord.dropIn} studentName={attendanceRecord.studentName} />
              ) : (
                <StatusTag tone="positive">
                  {attendanceRecord?.cardName}
                  {attendanceRecord.sessionsUsed > 1 && ` −${attendanceRecord.sessionsUsed}`}
                </StatusTag>
              )}
              {/* 沒付的單堂：右邊放「收款」按鈕，不再佔一欄文字 */}
              {(showIncome || !attendanceRecord.dropIn || attendanceRecord.dropIn.isPaid) && (
              <div className="text-sm text-neutral-600 w-24 text-right">
                {showIncome ? (
                  <span className="font-semibold text-neutral-900">${Math.round(attendanceRecord?.income)}</span>
                ) : attendanceRecord.dropIn ? (
                  <span>{attendanceRecord.dropIn.paymentMethod === "TRANSFER" ? "轉帳" : "現金"}</span>
                ) : (
                  <span>
                    剩 {attendanceRecord?.remainingSessions} 堂
                  </span>
                )}
              </div>
              )}
            </div>
          ))}
          {showIncome && (
            <div className="flex justify-between w-full px-3 py-2.5 bg-primary-50 rounded-xl mt-2">
              <span className="text-sm font-semibold text-neutral-700">合計</span>
              <span className="text-sm font-bold text-primary-900">
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
                <StatusTag tone="danger">缺席</StatusTag>
              </div>
            ))}
          </div>
        )}

        {period && <DayCollections date={toTaipeiDateKey(new Date(period.startTime))} />}

        <div className="flex flex-col gap-2.5 w-full mt-2">
          {isLastAttend && (
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={`/lessons/${id}/periods/${periodId}/check-edit`}>
                <PencilLine className="size-4" />
                編輯點名
              </Link>
            </Button>
          )}
          <Button asChild size="lg" className="w-full">
            <Link href={`/lessons/${id}`}>回到課程</Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default CheckPeriodSuccess;

/** 這筆出席付單堂：已付是灰色標籤，沒付是淡橘標籤＋收款。 */
const DropInStatus = ({
  dropIn,
  studentName,
}: {
  dropIn: NonNullable<AttendanceRecord["dropIn"]>;
  studentName: string;
}) =>
  dropIn.isPaid ? (
    <StatusTag tone="neutral">單堂 ${formatMoney(dropIn.amount)}</StatusTag>
  ) : (
    <>
      <StatusTag tone="warning">單堂未付 ${formatMoney(dropIn.amount)}</StatusTag>
      <ConfirmDropInForm chargeId={dropIn.id} amount={dropIn.amount} studentName={studentName} />
    </>
  );
