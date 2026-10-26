import { useState } from "react";
import { DatePicker } from "@/components/DatePicker";
import TimePicker, {
  Option,
  generateTimeOptions,
} from "@/components/TimePicker";
import { format, addDays } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/Field";

const getInitialTimeOption = (isoString: string): Option | null => {
  const timeValue = format(new Date(isoString), "H:mm");
  return generateTimeOptions().find((o) => o.value === timeValue) ?? null;
};

const validationErrors = {
  empty: "不可空白",
  toTimeMustGreater: "必須晚於開始時間",
};

const validateForm = (data: {
  date: Date | undefined;
  fromTime: string | undefined;
  toTime: string | undefined;
}) => {
  const errors: { date?: string; fromTime?: string; toTime?: string } = {};
  if (!data.date) {
    errors.date = validationErrors.empty;
  }
  if (!data.fromTime) {
    errors.fromTime = validationErrors.empty;
  }
  if (!data.toTime) {
    errors.toTime = validationErrors.empty;
  }
  // fromTime: "16:00", toTime: "17:00"
  if (data.fromTime && data.toTime && data.fromTime >= data.toTime) {
    errors.toTime = validationErrors.toTimeMustGreater;
  }
  return errors;
};

const AddPeriodForm = ({
  periods,
  onAddPeriod,
  error,
  initialPeriod,
}: {
  periods: { startTime: string; endTime: string }[];
  onAddPeriod: (period: { startTime: string; endTime: string }) => void;
  error?: string;
  initialPeriod?: { startTime: string; endTime: string };
}) => {
  const [date, setDate] = useState<Date | undefined>(
    initialPeriod ? new Date(initialPeriod.startTime) : new Date()
  );
  const [fromTime, setFromTime] = useState<Option | null>(
    initialPeriod ? getInitialTimeOption(initialPeriod.startTime) : null
  );
  const [toTime, setToTime] = useState<Option | null>(
    initialPeriod ? getInitialTimeOption(initialPeriod.endTime) : null
  );
  const [errors, setErrors] = useState<{
    date?: string;
    fromTime?: string;
    toTime?: string;
  }>({});

  const handleDateChange = (date: Date | undefined) => {
    if (errors.date) {
      setErrors({ ...errors, date: undefined });
    }
    setDate(date);
  };

  const handleFromTimeChange = (time: Option | null) => {
    if (errors.fromTime) {
      setErrors({ ...errors, fromTime: undefined });
    }
    setFromTime(time);
    if (time) {
      const [hour, minute] = time.value.split(":");
      const toHour = parseInt(hour) + 1;
      const toMinute = minute;
      const timeOptions = generateTimeOptions();
      const toValue = `${toHour}:${toMinute}`;
      const toTimeOption = timeOptions.find(
        (option) => option.value === toValue
      );
      if (toTimeOption) {
        setToTime(toTimeOption);
      }
    }
  };

  const handleToTimeChange = (time: Option | null) => {
    if (errors.toTime) {
      setErrors({ ...errors, toTime: undefined });
      return;
    }
    setToTime(time);
  };

  const addOneWeek = () => {
    if (errors.date) {
      setErrors({ ...errors, date: undefined });
    }
    const newDate = addDays(new Date(date || new Date()), 7);
    setDate(newDate);
  };

  const minusOneWeek = () => {
    if (errors.date) {
      setErrors({ ...errors, date: undefined });
    }
    const newDate = addDays(new Date(date || new Date()), -7);
    setDate(newDate);
  };

  const handleSubmit = () => {
    const errors = validateForm({
      date,
      fromTime: fromTime?.value,
      toTime: toTime?.value,
    });

    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }

    if (!date) {
      return;
    }

    const dateString = format(date, "yyyy-MM-dd");

    const fromDateTime = new Date(`${dateString}T${fromTime?.value}:00+08:00`);
    const toDateTime = new Date(`${dateString}T${toTime?.value}:00+08:00`);

    const startTime = fromDateTime.toISOString();
    const endTime = toDateTime.toISOString();

    const isDuplicated = periods.some((period) => {
      return period.startTime === startTime && period.endTime === endTime;
    });

    if (isDuplicated) {
      setErrors({ ...errors, date: "時段重複" });
      return;
    }

    onAddPeriod({
      startTime,
      endTime,
    });
  };

  return (
    <div className="border-b border-neutral-200 py-1 flex flex-col gap-3">
      <span className="text-base font-bold text-neutral-900 -mb-1">時段</span>
      <div className="flex gap-2 items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>日期</FieldLabel>
          <DatePicker date={date} setDate={handleDateChange} />
          <FieldError>{errors.date}</FieldError>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>開始</FieldLabel>
          <TimePicker
            selectedTime={fromTime}
            setSelectedTime={handleFromTimeChange}
          />
          <FieldError>{errors.fromTime}</FieldError>
        </div>
        <span className="text-sm text-neutral-500 mt-7">-</span>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>結束</FieldLabel>
          <TimePicker
            selectedTime={toTime}
            setSelectedTime={handleToTimeChange}
          />
          <FieldError>{errors.toTime}</FieldError>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={minusOneWeek}>
            -1 週
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={addOneWeek}>
            +1 週
          </Button>
        </div>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={handleSubmit}>
          <Plus className="size-4" />
          新增時段
        </Button>
      </div>
      <FieldError>{error}</FieldError>
      <div></div>
    </div>
  );
};

export default AddPeriodForm;
