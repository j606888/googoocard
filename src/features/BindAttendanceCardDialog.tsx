"use client";

import { X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetAttendanceQuery, useGetLessonQuery } from "@/store/slices/lessons";
import {
  PendingRecordAction,
  uncheckedDescription,
} from "@/features/lessons/LessonDetail/CheckPeriodSuccess/PendingStudents";
import { formatDate } from "@/lib/utils";

export interface BindCardTarget {
  lessonId: number;
  lessonPeriodId: number;
  lessonName: string;
  lessonPeriodStartTime: string;
  studentId: number;
  studentName: string;
}

/**
 * 待處理鈴鐺的「補卡」：不用回到課程頁，就地幫一筆沒綁卡的出席補上課卡。
 * 跟點名完成頁（CheckPeriodSuccess）的「未綁定課卡學生」是同一套表單
 * （PendingRecordAction），只是攤開放在這個對話框裡。
 */
export default function BindAttendanceCardDialog({
  target,
  onClose,
}: {
  target: BindCardTarget | null;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog open={!!target} onClose={onClose}>
      {target && <BindCardBody target={target} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function BindCardBody({ target, onClose }: { target: BindCardTarget; onClose: () => void }) {
  const { data: lesson } = useGetLessonQuery(target.lessonId);
  const { data: records } = useGetAttendanceQuery({
    id: target.lessonId,
    periodId: target.lessonPeriodId,
  });
  const record = records?.find((r) => r.studentId === target.studentId);
  // 綁好卡的紀錄會帶 cardId；沒有 uncheckedType 也代表已經不用補了。
  const pending = record && !record.cardId && record.uncheckedType ? record : null;

  return (
    <div className="flex flex-col overflow-y-auto">
      <div className="relative flex flex-col items-center mb-5 px-11">
        <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900 text-center">
          為 {target.studentName} 補卡
        </ResponsiveDialogTitle>
        <p className="mt-0.5 text-center text-[13px] text-neutral-500">
          {formatDate(target.lessonPeriodStartTime)} {target.lessonName}
          {pending && lesson && ` · ${uncheckedDescription(pending, lesson)}`}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2"
          onClick={onClose}
          aria-label="關閉"
        >
          <X className="size-5" />
        </Button>
      </div>

      {!lesson || !records ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : pending ? (
        <div className="flex justify-center">
          <PendingRecordAction
            record={pending}
            lesson={lesson}
            periodId={target.lessonPeriodId}
            inline
            onDone={onClose}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-neutral-600">這筆出席已經處理好了</p>
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
        </div>
      )}
    </div>
  );
}
