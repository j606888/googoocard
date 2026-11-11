"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, PencilLine, X } from "lucide-react";
import {
  type AttendanceRecord,
  type Lesson,
  type LessonStudent,
  useGetAttendanceQuery,
} from "@/store/slices/lessons";
import SideSheet, { SideSheetTitle } from "@/components/SideSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { lessonDropInOptions } from "@/lib/dropInOptions";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import PendingStudents from "./CheckPeriodSuccess/PendingStudents";
import DayCollections from "./CheckPeriodSuccess/DayCollections";
import { DropInStatus } from "./CheckPeriodSuccess";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// 已解決 = 扣了卡或付了單堂（$0 的體驗卡 income 是 0，不能拿 income 判斷）。
const isResolved = (record: AttendanceRecord) => Boolean(record.cardName || record.dropIn);

/**
 * 桌面版：已點名時段的紀錄，開在課程頁右側，名單留在原地。
 * 上一堂／下一堂只在「已點名」的時段之間移動。
 *
 * 「剩幾堂」只在最近點名的那一堂顯示——API 給的是課卡現在的剩餘數，
 * 放在兩個月前的時段上會被讀成當時的數字。
 */
const PeriodRecordSheet = ({
  lesson,
  students,
  periodId,
  onSelect,
  onClose,
  onOpenStudent,
}: {
  lesson: Lesson;
  students: LessonStudent[];
  periodId: number | null;
  onSelect: (periodId: number) => void;
  onClose: () => void;
  onOpenStudent: (studentId: number) => void;
}) => {
  const periods = useMemo(
    () =>
      [...(lesson.periods ?? [])].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    [lesson.periods]
  );
  const taken = periods.filter((p) => p.attendanceTakenAt);
  const period = periods.find((p) => p.id === periodId);
  const takenIndex = taken.findIndex((p) => p.id === periodId);
  const older = takenIndex > 0 ? taken[takenIndex - 1] : null;
  const newer = takenIndex >= 0 && takenIndex < taken.length - 1 ? taken[takenIndex + 1] : null;
  const isLatest = takenIndex === taken.length - 1;

  // `currentData`: while the next period loads, don't show the previous one's list.
  const { currentData: records } = useGetAttendanceQuery(
    { id: lesson.id, periodId: periodId as number },
    { skip: periodId == null }
  );

  const pending = records?.filter((record) => !isResolved(record)) ?? [];
  const resolved = records?.filter(isResolved) ?? [];
  const income = Math.round(resolved.reduce((sum, record) => sum + record.income, 0));
  const absent = period
    ? students.filter((student) =>
        student.attendances.some(
          (a) => a.startTime === period.startTime && a.attendanceStatus === "absent"
        )
      )
    : [];

  const start = period ? new Date(period.startTime) : null;
  const dropInOptions = lessonDropInOptions(lesson);

  return (
    <SideSheet open={periodId != null} onClose={onClose} className="w-[480px]">
      <div className="flex-none flex items-center justify-between h-13 pl-3 pr-2.5 border-b border-neutral-100">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            className="text-neutral-500"
            aria-label="上一堂"
            disabled={!older}
            onClick={() => older && onSelect(older.id)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            className="text-neutral-500"
            aria-label="下一堂"
            disabled={!newer}
            onClick={() => newer && onSelect(newer.id)}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          {period && (
            <span className="ml-1.5 text-[13px] text-neutral-500 tabular-nums">
              第 {periods.indexOf(period) + 1} / {periods.length} 堂
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={onClose}
          aria-label="關閉"
          title="關閉（Esc）"
          className="text-neutral-500"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-none px-6 pt-5 pb-3">
        <SideSheetTitle className="text-xl font-bold text-neutral-900 tabular-nums">
          {start && period ? (
            <>
              {format(start, "MM/dd")}（{WEEKDAYS[start.getDay()]}）
              <span className="ml-2 text-sm font-normal text-neutral-600">
                {format(start, "HH:mm")}–{format(new Date(period.endTime), "HH:mm")}
              </span>
            </>
          ) : (
            "點名紀錄"
          )}
        </SideSheetTitle>
        {records ? (
          <p className="mt-1.5 text-sm text-neutral-600 tabular-nums">
            <span className="font-semibold text-primary-700">出席 {records.length}</span>
            {" · "}
            <span className="font-semibold text-danger-700">缺席 {absent.length}</span>
            {" · "}
            <span className="font-semibold text-neutral-900">收入 ${formatMoney(income)}</span>
          </p>
        ) : (
          <Skeleton className="mt-2 h-4 w-52" />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
        {!records ? (
          <div className="flex flex-col gap-3 pt-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.length > 0 && periodId != null && (
              <PendingStudents records={pending} lesson={lesson} periodId={periodId} />
            )}
            <ul>
              {resolved.map((record) => (
                <li
                  key={record.studentId}
                  className="flex min-h-11 flex-wrap items-center gap-2 border-b border-neutral-100 py-1.5"
                >
                  <Image
                    src={record.studentAvatarUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="shrink-0 rounded-full"
                  />
                  <button
                    type="button"
                    onClick={() => onOpenStudent(record.studentId)}
                    className="mr-auto cursor-pointer truncate text-left text-sm font-semibold text-neutral-900 hover:text-primary-700"
                  >
                    {record.studentName}
                  </button>
                  {record.dropIn ? (
                    <DropInStatus
                      dropIn={record.dropIn}
                      options={dropInOptions}
                      studentName={record.studentName}
                      lessonLocationId={lesson.locationId}
                    />
                  ) : (
                    <>
                      <span className="text-[13px] text-neutral-600">
                        {record.cardName}
                        {record.sessionsUsed > 1 && ` −${record.sessionsUsed}`}
                      </span>
                      {isLatest && (
                        <span
                          className={`w-14 text-right text-[13px] tabular-nums ${
                            record.remainingSessions === 0 ? "text-danger-700" : "text-neutral-600"
                          }`}
                        >
                          剩 {record.remainingSessions} 堂
                        </span>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {absent.length > 0 && (
              <p className="text-[13px] text-neutral-600">
                缺席：{absent.map((student) => student.name).join("、")}
              </p>
            )}
            {period && <DayCollections date={toTaipeiDateKey(new Date(period.startTime))} />}
          </div>
        )}
      </div>

      {period && (
        <div className="flex-none border-t border-neutral-100 px-6 py-3">
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href={`/lessons/${lesson.id}/periods/${period.id}/check-edit`}>
              <PencilLine className="size-4" />
              編輯點名
            </Link>
          </Button>
        </div>
      )}
    </SideSheet>
  );
};

export default PeriodRecordSheet;
