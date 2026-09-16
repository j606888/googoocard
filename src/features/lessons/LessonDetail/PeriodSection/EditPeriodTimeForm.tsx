import Drawer from "@/components/Drawer";
import { format } from "date-fns";
import { useState } from "react";
import { Period, useUpdatePeriodMutation } from "@/store/slices/lessons";
import { DatePicker } from "@/components/DatePicker";
import TimePicker, { Option, generateTimeOptions } from "@/components/TimePicker";
import { toast } from "sonner";

const timeOption = (value: string): Option | null =>
  generateTimeOptions().find((option: Option) => option.value === value) ?? null;

/**
 * Re-date an existing period. The teacher-facing repair for docs/roadmap.md P2-2:
 * before this, a class that moved (rain-off, venue swap) could only be deleted and
 * recreated, which threw away its attendance. Editing keeps the records — they move
 * with the period.
 */
const EditPeriodTimeForm = ({
  period,
  open,
  onClose,
}: {
  period: Period;
  open: boolean;
  onClose: () => void;
}) => {
  const start = new Date(period.startTime);
  const end = new Date(period.endTime);
  const [date, setDate] = useState<Date | undefined>(start);
  const [fromTime, setFromTime] = useState<Option | null>(timeOption(format(start, "HH:mm")));
  const [toTime, setToTime] = useState<Option | null>(timeOption(format(end, "HH:mm")));
  const [error, setError] = useState<string | null>(null);
  const [updatePeriod, { isLoading }] = useUpdatePeriodMutation();

  const attended = Boolean(period.attendanceTakenAt);

  const handleSubmit = async () => {
    if (!date || !fromTime || !toTime) {
      setError("日期與時間都不可空白");
      return;
    }
    if (fromTime.value >= toTime.value) {
      setError("結束時間必須晚於開始時間");
      return;
    }

    const dateString = format(date, "yyyy-MM-dd");
    await updatePeriod({
      id: period.lessonId,
      periodId: period.id,
      startTime: new Date(`${dateString}T${fromTime.value}:00+08:00`).toISOString(),
      endTime: new Date(`${dateString}T${toTime.value}:00+08:00`).toISOString(),
    }).unwrap();

    toast.success("已更新時段時間");
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="修改時段時間"
      submitText="儲存"
      isLoading={isLoading}
    >
      <div className="flex flex-col gap-0.5 mb-4">
        <label className="text-sm text-neutral-700">日期</label>
        <DatePicker date={date} setDate={setDate} />
      </div>
      <div className="flex gap-2 mb-4">
        <div>
          <label className="text-sm text-neutral-700">開始</label>
          <TimePicker selectedTime={fromTime} setSelectedTime={setFromTime} />
        </div>
        <div>
          <label className="text-sm text-neutral-700">結束</label>
          <TimePicker selectedTime={toTime} setSelectedTime={setToTime} />
        </div>
      </div>
      {attended && (
        <p className="mb-4 text-xs text-neutral-500">
          這個時段已經點名。改時間不會動到出席紀錄與課卡，只是把它掛到新的日期上。
        </p>
      )}
      {error && <p className="mb-4 text-sm text-danger-500">{error}</p>}
    </Drawer>
  );
};

export default EditPeriodTimeForm;
