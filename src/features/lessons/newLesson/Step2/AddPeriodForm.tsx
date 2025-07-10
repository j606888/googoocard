import { useState } from "react";
import AddButton from "@/components/AddButton";
import { DatePicker } from "@/components/DatePicker";
import TimePicker, { Option, generateTimeOptions } from "@/components/TimePicker";
import { format, addDays } from "date-fns";

const validationErrors = {
  empty: "Can not be empty",
  toTimeMustGreater: "Must greater than From",
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

const AddPeriodForm2 = ({
  onAddPeriod,
}: {
  onAddPeriod: (period: { startTime: string; endTime: string }) => void;
}) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [fromTime, setFromTime] = useState<Option | null>(null);
  const [toTime, setToTime] = useState<Option | null>(null);
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
      const timeOptions = generateTimeOptions()
      const toValue = `${toHour}:${toMinute}`;
      const toTimeOption = timeOptions.find((option) => option.value === toValue);
      if (toTimeOption) {
        setToTime(toTimeOption);
      }
    }
  }

  const handleToTimeChange = (time: Option | null) => {
    if (errors.toTime) {
      setErrors({ ...errors, toTime: undefined });
      return;
    }
    setToTime(time);
  };

  const handleSubmit = () => {
    const errors = validateForm({ date, fromTime: fromTime?.value, toTime: toTime?.value });

    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }

    if (!date) {
      return;
    }

    const dateString = format(date, "yyyy-MM-dd");

    console.log({ dateString, fromTime, toTime })
    const startTime = format(
      new Date(`${dateString}T${fromTime?.value}`),
      "yyyy-MM-dd HH:mm"
    );
    const endTime = format(new Date(`${dateString}T${toTime?.value}`), "yyyy-MM-dd HH:mm");

    onAddPeriod({
      startTime,
      endTime,
    });
    const newDate = addDays(new Date(date || new Date()), 7);
    setDate(newDate);
  };

  return (
    <div className="border-b border-gray-200 py-1 flex flex-col gap-3">
      <DatePicker date={date} setDate={handleDateChange} />
      {errors.date && <p className="text-sm text-red-500">{errors.date}</p>}
      <div className="flex gap-2 items-center">
        <div className="">
          <TimePicker selectedTime={fromTime} setSelectedTime={handleFromTimeChange} />
          {errors.fromTime && <p className="mt-0.5 text-xs text-red-500">{errors.fromTime}</p>}
        </div>
        <span className="text-sm text-gray-500">-</span>
        <div className="">
          <TimePicker selectedTime={toTime} setSelectedTime={handleToTimeChange} />
          {errors.toTime && <p className="mt-0.5 text-xs text-red-500">{errors.toTime}</p>}
        </div>
      </div>
      <div>
        <AddButton onClick={handleSubmit}>Add period</AddButton>
      </div>
    </div>
  );
};

export default AddPeriodForm2;
