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
  useGetPeriodTermQuery,
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
import KiwiMascot from "@/components/KiwiMascot";
import { headcountByPeriod } from "@/domains/attendance/rosterInsights";
import { useGetLessonAgendaQuery } from "@/store/slices/lessons";
import { buildToday } from "@/features/today/today";
import RenewalNudge from "./RenewalNudge";
import { headcountDeltaLabel, renewalCandidates, summaryHeadline } from "./periodSummary";
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
  // 整期：這堂涵蓋的整期學生與每人每堂價——有來沒來都算進這堂收入。
  const { data: term } = useGetPeriodTermQuery({ id: Number(id), periodId: Number(periodId) });
  const { data: rosterStudents, isLoading: isRosterLoading } =
    useGetLessonStudentsQuery({ id: Number(id) });
  const period = lesson?.periods.find(
    (period) => period.id === Number(periodId)
  );
  // 「11/05（四）20:30–21:30」：手機放在頁首副標，桌面放在標題下面。
  const when = period
    ? `${format(new Date(period.startTime), "M/d")}（${WEEKDAYS[new Date(period.startTime).getDay()]}）${format(
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
        size="sm"
        className="px-2 text-neutral-700"
        disabled={!olderTaken}
        onClick={() => olderTaken && goToPeriod(olderTaken)}
      >
        <ChevronLeft className="size-4" />
        前一堂紀錄
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-2 text-neutral-700"
        disabled={!newerTaken}
        onClick={() => newerTaken && goToPeriod(newerTaken)}
      >
        後一堂紀錄
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
  // 只點過這一堂就沒有別的紀錄可翻——兩顆都是灰的比不出現更像壞掉。
  const showPager = !justSubmitted && Boolean(olderTaken || newerTaken);

  // 已解決 = 扣了卡、付了單堂或報了整期（$0 的體驗卡 income 是 0，不能拿 income 判斷）。
  const isResolved = (record: AttendanceRecord) => Boolean(record.cardName || record.dropIn || record.enrollment);
  const pendingRecords = attendanceRecords?.filter((record) => !isResolved(record)) || [];
  const paidRecords = attendanceRecords?.filter(isResolved) || [];

  // Enrolled students the roster marks absent for this exact period — visible
  // here for the first time (the old success screen only ever listed who
  // attended).
  const enrolled = useMemo(() => (term?.offered ? term.enrolled : []), [term]);
  const enrolledIds = useMemo(() => new Set(enrolled.map((e) => e.student.id)), [enrolled]);
  const absentStudents = useMemo(() => {
    if (!period || !rosterStudents) return [];
    return rosterStudents.filter(
      (student) =>
        !enrolledIds.has(student.id) &&
        student.attendances.some(
          (a) => a.startTime === period.startTime && a.attendanceStatus === "absent"
        )
    );
  }, [period, rosterStudents, enrolledIds]);
  // 整期學生裡沒來的：請假或曠課（曠課 = 沒請假）。
  const enrolledMissing = useMemo(() => {
    const attended = new Set((attendanceRecords ?? []).map((r) => r.studentId));
    return enrolled.filter((e) => !attended.has(e.student.id));
  }, [enrolled, attendanceRecords]);

  // 「比上一堂多 3 人」：跟課程頁同一份名冊推導（已點名的時段，由舊到新）。
  const deltaLabel = useMemo(
    () =>
      headcountDeltaLabel(
        headcountByPeriod(rosterStudents ?? [], lesson?.periods ?? []).filter((column) => column.taken),
        Number(periodId)
      ),
    [rosterStudents, lesson?.periods, periodId]
  );

  // 今天還有下一堂要點名的話，頁尾直接給一顆去那一堂（同今天頁的挑法：只挑今天的課）。
  const { data: agenda } = useGetLessonAgendaQuery();
  const nextToday = useMemo(() => {
    const view = buildToday(agenda?.periods ?? [], new Date(), agenda?.myTeacherId ?? null);
    return (
      [...(view.heroIsToday && view.hero ? [view.hero] : []), ...view.later]
        .map((row) => row.period)
        .find((p) => !p.attendanceTakenAt && p.id !== Number(periodId)) ?? null
    );
  }, [agenda, periodId]);

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

  // 這堂收入 = 課卡／單堂（有來才算）＋ 整期（報名的人每人一份，來不來都算）。跟收入頁同一套。
  const sumIncome = (records: AttendanceRecord[]) => records.reduce((sum, record) => sum + record.income, 0);
  const cardRecords = paidRecords.filter((record) => record.cardName);
  const dropInRecords = paidRecords.filter((record) => record.dropIn);
  const termIncome = enrolled.reduce((sum, e) => sum + e.perSession, 0);
  const income = Math.round(sumIncome(cardRecords) + sumIncome(dropInRecords) + termIncome);
  const termPerSessionLabel = (() => {
    const prices = [...new Set(enrolled.map((e) => Math.round(e.perSession)))];
    return prices.length === 1 ? `$${formatMoney(prices[0])}` : null;
  })();
  const leaveCount = enrolledMissing.filter((e) => e.onLeave).length;
  const absentCount = absentStudents.length + (period?.attendanceTakenAt ? enrolledMissing.length : 0);
  const headline = summaryHeadline({
    justSubmitted,
    attended: attendanceRecords.length,
    absent: absentCount,
  });
  const renewals = renewalCandidates(attendanceRecords, isLatest);
  const editHref = `/lessons/${id}/periods/${periodId}/check-edit`;
  const tile = "flex flex-1 flex-col-reverse gap-0.5 rounded-2xl bg-white px-1 py-2.5 shadow-[0_8px_20px_rgba(20,35,29,0.10)] lg:border lg:border-neutral-200 lg:shadow-none";

  return (
    <>
      {!isExpanded && (
        /* 手機：綠色頁首＋奇異鳥。剛送出是慶祝，回頭看就是紀錄。 */
        <header className="rounded-b-[32px] bg-primary-900 px-4 pt-2 pb-14 text-white">
          <div className="flex items-center justify-between">
            <Link
              href={`/lessons/${id}`}
              aria-label="回到課程"
              className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ArrowLeft className="size-5" />
            </Link>
            {period?.attendanceTakenAt && (
              <Link
                href={editHref}
                className="flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold hover:bg-white/25"
              >
                <PencilLine className="size-4" />
                編輯點名
              </Link>
            )}
          </div>
          <div className="mt-3 flex items-end gap-3.5">
            <span className="relative grid size-20 shrink-0 place-items-center rounded-full bg-accent-500">
              {/* 剛送出：全員到齊跳起來、不然開心；回頭看紀錄是得意的那一隻。 */}
              <KiwiMascot
                pose={!justSubmitted ? "proud" : absentCount === 0 ? "jump" : "happy"}
                className="w-[60px]"
              />
              {justSubmitted && (
                <span className="absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full bg-white text-primary-900">
                  <Check className="size-4" strokeWidth={3.2} />
                </span>
              )}
            </span>
            <div className="min-w-0 pb-0.5">
              <h1 className="text-[26px] font-bold leading-8">{headline}</h1>
              <p className="truncate text-sm font-medium text-primary-100">{lesson.name}</p>
              <p className="truncate text-[13px] tabular-nums text-primary-100">
                {[when, deltaLabel].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </header>
      )}
      {/* 手機底下留給浮動的 BottomNav；桌面置中——點名結果是逐列的清單，全寬拉開反而難讀。 */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-28 lg:max-w-2xl lg:px-8 lg:pt-6 lg:pb-10">
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
              {deltaLabel && <p className="text-[13px] text-neutral-600">{deltaLabel}</p>}
            </div>
            {showPager && periodPager}
          </div>
        )}
        {isExpanded && justSubmitted && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex justify-center items-center rounded-full bg-primary-100 w-20 h-20 ring-8 ring-primary-50">
              <Check className="w-11 h-11 text-primary-700" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <h3 className="text-lg font-bold text-neutral-900">{headline}</h3>
              <p className="text-sm text-neutral-500">{formattedNow}</p>
            </div>
          </div>
        )}

        <dl className="relative -mt-10 flex w-full gap-2 text-center lg:mt-0">
          <div className={tile}>
            <dt className="text-xs text-neutral-600">出席</dt>
            <dd className="text-xl font-bold text-primary-900 tabular-nums">{attendanceRecords.length}</dd>
          </div>
          <div className={tile}>
            <dt className="text-xs text-neutral-600">缺席</dt>
            <dd
              className={`text-xl font-bold tabular-nums ${
                absentCount > 0 ? "text-danger-700" : "text-neutral-900"
              }`}
            >
              {absentCount}
            </dd>
          </div>
          {pendingRecords.length > 0 && (
            <div className={tile}>
              <dt className="text-xs text-warning-950">待處理</dt>
              <dd className="text-xl font-bold text-warning-950 tabular-nums">{pendingRecords.length}</dd>
            </div>
          )}
          <div className={tile}>
            <dt className="text-xs text-neutral-600">這堂收入</dt>
            <dd className="text-xl font-bold text-neutral-900 tabular-nums">${formatMoney(income)}</dd>
          </div>
        </dl>
        {enrolled.length > 0 && (
          <div className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white text-sm">
            <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-neutral-900">
                  整期 {enrolled.length} 人{termPerSessionLabel && ` × ${termPerSessionLabel}`}
                </span>
                <span className="text-xs text-neutral-500">
                  來 {enrolled.length - enrolledMissing.length}
                  {leaveCount > 0 && ` · 請假 ${leaveCount}`}
                  {enrolledMissing.length - leaveCount > 0 && ` · 曠課 ${enrolledMissing.length - leaveCount}`}
                  ・請假曠課照算
                </span>
              </span>
              <span className="font-semibold tabular-nums">${formatMoney(Math.round(termIncome))}</span>
            </div>
            {cardRecords.length > 0 && (
              <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="text-neutral-700">課卡 {cardRecords.length} 人</span>
                <span className="tabular-nums">${formatMoney(Math.round(sumIncome(cardRecords)))}</span>
              </div>
            )}
            {dropInRecords.length > 0 && (
              <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="text-neutral-700">單堂 {dropInRecords.length} 人</span>
                <span className="tabular-nums">${formatMoney(Math.round(sumIncome(dropInRecords)))}</span>
              </div>
            )}
          </div>
        )}
        {!isExpanded && showPager && <div className="-my-2 flex justify-center">{periodPager}</div>}

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
                />
              ) : attendanceRecord.enrollment ? (
                <StatusTag tone="outline">整期</StatusTag>
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
                : isLatest && !attendanceRecord.enrollment && (
                    <span className="w-16 text-right text-sm tabular-nums text-neutral-600">
                      剩 {attendanceRecord?.remainingSessions} 堂
                    </span>
                  )}
            </div>
          ))}
        </div>

        {period?.attendanceTakenAt && enrolledMissing.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {enrolledMissing.map(({ student, onLeave }) => (
              <div className="flex gap-2 items-center" key={student.id}>
                <StudentInfo
                  studentId={student.id}
                  avatarUrl={student.avatarUrl}
                  name={student.name}
                  size="small"
                  className="mr-auto"
                />
                <StatusTag tone={onLeave ? "warning" : "danger"}>整期 · {onLeave ? "請假" : "曠課"}</StatusTag>
              </div>
            ))}
          </div>
        )}

        {absentStudents.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {absentStudents.map((student) => (
              <div className="flex gap-2 items-center" key={student.id}>
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

        <RenewalNudge
          candidates={renewals}
          danceLevelsOf={(studentId) => rosterStudents?.find((student) => student.id === studentId)?.danceLevels}
        />

        {period && <DayCollections date={toTaipeiDateKey(new Date(period.startTime))} />}

        <div className="flex flex-col gap-2.5 w-full mt-2">
          {isExpanded && period?.attendanceTakenAt && (
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={editHref}>
                <PencilLine className="size-4" />
                編輯點名
              </Link>
            </Button>
          )}
          {nextToday && (
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={`/lessons/${nextToday.lesson.id}/periods/${nextToday.id}/check`}>
                接著點名 · {format(new Date(nextToday.startTime), "HH:mm")} {nextToday.lesson.name}
              </Link>
            </Button>
          )}
          <div className="flex gap-2.5">
            <Button asChild variant="secondary" size="lg" className="flex-1">
              <Link href={`/lessons/${id}`}>回到課程</Link>
            </Button>
            <Button asChild size="lg" className="flex-1">
              <Link href="/today">回今天</Link>
            </Button>
          </div>
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
}: {
  dropIn: NonNullable<AttendanceRecord["dropIn"]>;
  options: DropInOption[];
  studentName: string;
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
      />
    </>
  );
};
