import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import SubNavbar from "@/features/SubNavbar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  type AttendanceRecord,
  useGetAttendanceQuery,
  useGetLessonQuery,
  useGetLessonStudentsQuery,
} from "@/store/slices/lessons";
import StudentInfo from "@/components/StudentInfo";
import PendingStudents from "./PendingStudents";
import DayCollections from "./DayCollections";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { formatMoney } from "@/lib/money";
import { ConfirmDropInForm } from "./DropInForm";
import { type DropInOption, lessonDropInOptions } from "@/lib/dropInOptions";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const CheckPeriodSuccess = () => {
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
  // 「11/05（四）20:30–21:30」：手機放在頁首副標，桌面放在標題下面。
  const when = period
    ? `${format(new Date(period.startTime), "MM/dd")}（${WEEKDAYS[new Date(period.startTime).getDay()]}）${format(
        new Date(period.startTime),
        "HH:mm"
      )}–${format(new Date(period.endTime), "HH:mm")}`
    : "";
  const formattedNow =
    period?.attendanceTakenAt &&
    format(period?.attendanceTakenAt, "yyyy/MM/dd, hh:mm a");
  // 「剩幾堂」是課卡現在的剩餘數，只有最近點名的那一堂顯示才不會被讀成當時的數字。
  const latestTakenId = [...(lesson?.periods ?? [])]
    .filter((p) => p.attendanceTakenAt)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0]?.id;
  const isLatest = period?.id === latestTakenId;

  // 上一堂／下一堂只在「已點名」的時段之間移動（同 PeriodRecordSheet 的規則）。
  const router = useRouter();
  const takenPeriods = useMemo(
    () =>
      [...(lesson?.periods ?? [])]
        .filter((p) => p.attendanceTakenAt)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [lesson?.periods]
  );
  const takenIndex = takenPeriods.findIndex((p) => p.id === Number(periodId));
  const olderTaken = takenIndex > 0 ? takenPeriods[takenIndex - 1] : null;
  const newerTaken =
    takenIndex >= 0 && takenIndex < takenPeriods.length - 1 ? takenPeriods[takenIndex + 1] : null;
  const goToPeriod = (target: { id: number }) =>
    router.replace(`/lessons/${id}/periods/${target.id}/check-success`);
  const periodPager = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-neutral-600"
        aria-label="上一堂"
        disabled={!olderTaken}
        onClick={() => olderTaken && goToPeriod(olderTaken)}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-neutral-600"
        aria-label="下一堂"
        disabled={!newerTaken}
        onClick={() => newerTaken && goToPeriod(newerTaken)}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
  const showPager = !justSubmitted && takenIndex >= 0;

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

  const income = Math.round(paidRecords.reduce((sum, record) => sum + record.income, 0));

  return (
    <>
      {!isExpanded && (
        <SubNavbar title={lesson?.name || ""} subtitle={when} backUrl={`/lessons/${id}`} />
      )}
      {/* 手機底下留給浮動的 BottomNav；桌面置中——點名結果是逐列的清單，全寬拉開反而難讀。 */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pt-6 pb-28 lg:max-w-2xl lg:px-8 lg:pb-10">
        {isExpanded && (
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Link
                href={`/lessons/${id}`}
                className="inline-flex items-center gap-1 self-start text-[13px] text-neutral-600 hover:text-neutral-900"
              >
                <ArrowLeft className="size-4" />
                {lesson.name}
              </Link>
              <h1 className="text-xl font-bold text-neutral-900 tabular-nums">{when}</h1>
            </div>
            {showPager && periodPager}
          </div>
        )}
        {!isExpanded && showPager && <div className="flex justify-end">{periodPager}</div>}
        {justSubmitted && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex justify-center items-center rounded-full bg-primary-100 w-20 h-20 ring-8 ring-primary-50">
              <Check className="w-11 h-11 text-primary-700" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <h3 className="text-lg font-bold text-neutral-900">課程簽到成功</h3>
              <p className="text-sm text-neutral-500">{formattedNow}</p>
            </div>
          </div>
        )}

        <dl className="flex w-full gap-2 text-center">
          <div className="flex flex-1 flex-col-reverse gap-0.5 rounded-xl bg-primary-50 py-2.5">
            <dt className="text-xs text-primary-900">出席</dt>
            <dd className="text-lg font-bold text-primary-900 tabular-nums">{attendanceRecords.length}</dd>
          </div>
          <div className="flex flex-1 flex-col-reverse gap-0.5 rounded-xl bg-danger-50 py-2.5">
            <dt className="text-xs text-danger-700">缺席</dt>
            <dd className="text-lg font-bold text-danger-700 tabular-nums">{absentStudents.length}</dd>
          </div>
          {pendingRecords.length > 0 && (
            <div className="flex flex-1 flex-col-reverse gap-0.5 rounded-xl bg-warning-50 py-2.5">
              <dt className="text-xs text-warning-900">待處理</dt>
              <dd className="text-lg font-bold text-warning-900 tabular-nums">{pendingRecords.length}</dd>
            </div>
          )}
          <div className="flex flex-1 flex-col-reverse gap-0.5 rounded-xl bg-neutral-100 py-2.5">
            <dt className="text-xs text-neutral-700">這堂收入</dt>
            <dd className="text-lg font-bold text-neutral-900 tabular-nums">${formatMoney(income)}</dd>
          </div>
        </dl>

        {pendingRecords.length > 0 && (
          <PendingStudents records={pendingRecords} lesson={lesson} periodId={Number(periodId)} />
        )}
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
                <DropInStatus
                  dropIn={attendanceRecord.dropIn}
                  options={lessonDropInOptions(lesson)}
                  studentName={attendanceRecord.studentName}
                  lessonLocationId={lesson.locationId}
                />
              ) : (
                <StatusTag tone="positive">
                  {attendanceRecord?.cardName}
                  {attendanceRecord.sessionsUsed > 1 && ` −${attendanceRecord.sessionsUsed}`}
                </StatusTag>
              )}
              {attendanceRecord.dropIn
                ? attendanceRecord.dropIn.isPaid && (
                    <span className="w-16 text-right text-sm text-neutral-600">
                      {attendanceRecord.dropIn.paymentMethod === "TRANSFER" ? "轉帳" : "現金"}
                    </span>
                  )
                : isLatest && (
                    <span className="w-16 text-right text-sm tabular-nums text-neutral-600">
                      剩 {attendanceRecord?.remainingSessions} 堂
                    </span>
                  )}
            </div>
          ))}
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
          {period?.attendanceTakenAt && (
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
export const DropInStatus = ({
  dropIn,
  options,
  studentName,
  lessonLocationId,
}: {
  dropIn: NonNullable<AttendanceRecord["dropIn"]>;
  options: DropInOption[];
  studentName: string;
  lessonLocationId: number | null;
}) => {
  // 選了非預設方案（複習價、雙人合報…）用醒目的標籤，收款時一眼核對。
  const isSpecial = Boolean(dropIn.optionName) && dropIn.optionName !== options[0]?.name;
  const plan = dropIn.optionName ? (
    <StatusTag tone={isSpecial ? "outline" : "neutral"}>{dropIn.optionName}</StatusTag>
  ) : null;
  return dropIn.isPaid ? (
    <>
      {plan}
      <StatusTag tone="neutral">單堂 ${formatMoney(dropIn.amount)}</StatusTag>
    </>
  ) : (
    <>
      {plan}
      <StatusTag tone="warning">單堂未付 ${formatMoney(dropIn.amount)}</StatusTag>
      <ConfirmDropInForm
        chargeId={dropIn.id}
        amount={dropIn.amount}
        optionName={dropIn.optionName}
        options={options}
        studentName={studentName}
        lessonLocationId={lessonLocationId}
      />
    </>
  );
};
