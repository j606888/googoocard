"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import Drawer from "@/components/Drawer";
import { DatePicker } from "@/components/DatePicker";
import TimePicker, { Option, generateTimeOptions } from "@/components/TimePicker";
import {
  LessonSummary,
  useCreatePeriodsMutation,
  useEndLessonMutation,
} from "@/store/slices/lessons";
import { nextPeriodDefault } from "./lessonGrouping";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
/** 「一次排幾週」勾起來時連排的週數。 */
const BATCH_WEEKS = 4;

const timeOption = (date: Date): Option | null =>
  generateTimeOptions().find((o) => o.value === format(date, "HH:mm")) ?? null;

/**
 * 列表上的「＋下一堂」：持續開課的課，沿用上一堂的星期與時間一鍵排課。
 * 老師、課卡、舞種都跟著課走，所以這裡只問時間。
 */
const NextPeriodDrawer = ({
  lesson,
  onClose,
}: {
  lesson: LessonSummary;
  onClose: () => void;
}) => {
  const [defaults] = useState(() =>
    nextPeriodDefault(lesson.lastPeriodStart, lesson.lastPeriodEnd, new Date())
  );
  const [date, setDate] = useState<Date | undefined>(defaults?.startTime ?? new Date());
  const [fromTime, setFromTime] = useState<Option | null>(
    defaults ? timeOption(defaults.startTime) : null
  );
  const [toTime, setToTime] = useState<Option | null>(
    defaults ? timeOption(defaults.endTime) : null
  );
  const [batch, setBatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createPeriods, { isLoading }] = useCreatePeriodsMutation();
  const [endLesson, { isLoading: isEnding }] = useEndLessonMutation();

  const weeks = batch ? BATCH_WEEKS : 1;
  const dates = date ? Array.from({ length: weeks }, (_, i) => addDays(date, i * 7)) : [];

  const handleSubmit = async () => {
    if (!date || !fromTime || !toTime) {
      setError("請選擇日期與時間");
      return;
    }
    if (fromTime.value >= toTime.value) {
      setError("結束時間必須晚於開始時間");
      return;
    }
    const periods = dates.map((d) => {
      const day = format(d, "yyyy-MM-dd");
      return {
        startTime: new Date(`${day}T${fromTime.value}:00+08:00`).toISOString(),
        endTime: new Date(`${day}T${toTime.value}:00+08:00`).toISOString(),
      };
    });
    await createPeriods({ id: lesson.id, periods }).unwrap();
    onClose();
  };

  const handleEnd = async () => {
    if (!confirm(`確定要結束「${lesson.name}」嗎？之後可以在「已結束」重新開課。`)) return;
    await endLesson(lesson.id).unwrap();
    onClose();
  };

  return (
    <Drawer
      open
      title="排下一堂"
      submitText={weeks > 1 ? `新增 ${weeks} 堂` : "新增這一堂"}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-neutral-500">
          {lesson.name}
          {lesson.totalPeriods > 0 && ` · 已上 ${lesson.attendedCount} 堂`}
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-neutral-700">日期</label>
          <DatePicker
            date={date}
            setDate={(d) => {
              setError(null);
              setDate(d);
            }}
          />
          {defaults && (
            <p className="text-xs text-neutral-400">預設沿用上一堂的星期與時間</p>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-700">開始</label>
            <TimePicker
              selectedTime={fromTime}
              setSelectedTime={(t) => {
                setError(null);
                setFromTime(t);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-700">結束</label>
            <TimePicker
              selectedTime={toTime}
              setSelectedTime={(t) => {
                setError(null);
                setToTime(t);
              }}
            />
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={batch}
            onChange={(e) => setBatch(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary-500"
          />
          <span>
            一次排 {BATCH_WEEKS} 週
            {batch && dates.length > 0 && (
              <span className="block text-xs text-neutral-500 mt-0.5">
                {dates.map((d) => `${format(d, "M/d")}（${WEEKDAYS[d.getDay()]}）`).join("、")}
              </span>
            )}
          </span>
        </label>

        {error && <p className="text-sm text-danger-500">{error}</p>}

        {lesson.kind === "ongoing" && (
          <button
            type="button"
            onClick={handleEnd}
            disabled={isEnding}
            className="self-center text-sm text-neutral-500 hover:text-neutral-700 underline-offset-2 hover:underline disabled:opacity-50 cursor-pointer"
          >
            這門課不再開了 · 結束課程
          </button>
        )}
      </div>
    </Drawer>
  );
};

export default NextPeriodDrawer;
