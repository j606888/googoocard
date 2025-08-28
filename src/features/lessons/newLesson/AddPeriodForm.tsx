import { useState } from "react";
import { DatePicker } from "@/components/DatePicker";
import TimePicker, {
  Option,
  generateTimeOptions,
} from "@/components/TimePicker";
import { format, addDays } from "date-fns";
import { Plus } from "lucide-react";

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

const AddPeriodForm = ({
  periods,
  onAddPeriod,
  error,
}: {
  periods: { startTime: string; endTime: string }[];
  onAddPeriod: (period: { startTime: string; endTime: string }) => void;
  error?: string;
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
      setErrors({ ...errors, date: "Period exists" });
      return;
    }

    onAddPeriod({
      startTime,
      endTime,
    });
  };

  return (
    <div className="border-b border-gray-200 py-1 flex flex-col gap-3">
      <label className="font-medium -mb-3">Periods</label>
      <div className="flex gap-2 items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <label className="text-sm text-gray-700">Date</label>
          <DatePicker date={date} setDate={handleDateChange} />
          {errors.date && <p className="text-sm text-red-500">{errors.date}</p>}
        </div>
        <div className="">
          <label className="text-sm text-gray-700">From</label>
          <TimePicker
            selectedTime={fromTime}
            setSelectedTime={handleFromTimeChange}
          />
          {errors.fromTime && (
            <p className="mt-0.5 text-xs text-red-500">{errors.fromTime}</p>
          )}
        </div>
        <span className="text-sm text-gray-500 mt-5">-</span>
        <div className="">
          <label className="text-sm text-gray-700">To</label>
          <TimePicker
            selectedTime={toTime}
            setSelectedTime={handleToTimeChange}
          />
          {errors.toTime && (
            <p className="mt-0.5 text-xs text-red-500">{errors.toTime}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex gap-2">
          <div
            className="text-sm border border-primary-500 rounded-md px-2 py-1 text-primary-700 cursor-pointer hover:bg-primary-50"
            onClick={minusOneWeek}
          >
            -1 Week
          </div>
          <div
            className="text-sm border border-primary-500 rounded-md px-2 py-1 text-primary-700 cursor-pointer hover:bg-primary-50"
            onClick={addOneWeek}
          >
            +1 Week
          </div>
        </div>
        <button
          className="bg-primary-500 text-white text-sm px-4 py-1.5 rounded-sm flex items-center justify-center gap-2 ml-auto cursor-pointer hover:bg-primary-600"
          onClick={handleSubmit}
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">Add Period</span>
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div></div>
    </div>
  );
};

export default AddPeriodForm;
