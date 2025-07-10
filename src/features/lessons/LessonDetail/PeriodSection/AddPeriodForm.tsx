import Drawer from "@/components/Drawer";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Period, useCreatePeriodMutation } from "@/store/slices/lessons";
import { DatePicker } from "@/components/DatePicker";
import TimePicker, {
  Option,
  generateTimeOptions,
} from "@/components/TimePicker";

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
  lessonId,
  periods,
}: {
  lessonId: number;
  periods: Period[];
}) => {
  const [newPeriodModalOpen, setNewPeriodModalOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [fromTime, setFromTime] = useState<Option | null>(null);
  const [toTime, setToTime] = useState<Option | null>(null);
  const [errors, setErrors] = useState<{
    date?: string;
    fromTime?: string;
    toTime?: string;
  }>({});
  const [createPeriod, { isLoading }] = useCreatePeriodMutation();

  console.log({ periods });

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

  const handleSubmit = async () => {
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
    const startTime = format(
      new Date(`${dateString}T${fromTime?.value}`),
      "yyyy-MM-dd HH:mm"
    );
    const endTime = format(
      new Date(`${dateString}T${toTime?.value}`),
      "yyyy-MM-dd HH:mm"
    );

    const isDuplicated = periods.some((period) => {
      const periodDate = format(period.startTime, "yyyy-MM-dd");
      const periodStartTime = format(period.startTime, "HH:mm");
      const periodEndTime = format(period.endTime, "HH:mm");

      return (
        periodDate === dateString &&
        periodStartTime === fromTime?.value &&
        periodEndTime === toTime?.value
      );
    });

    if (isDuplicated) {
      setErrors({ ...errors, date: "Period exists" });
      return;
    }

    await createPeriod({
      id: lessonId,
      startTime,
      endTime,
    });

    setNewPeriodModalOpen(false);
  };

  return (
    <>
      <button className="bg-primary-500 text-white px-3 py-1.5 rounded-full flex items-center gap-2">
        <Plus className="w-4 h-4" />
        <span
          className="text-sm font-medium"
          onClick={() => setNewPeriodModalOpen(true)}
        >
          Add Period
        </span>
      </button>
      {newPeriodModalOpen && (
        <Drawer
          open={newPeriodModalOpen}
          onClose={() => setNewPeriodModalOpen(false)}
          onSubmit={handleSubmit}
          title="New Period"
          submitText="Add Period"
          isLoading={isLoading}
        >
          <div className="flex flex-col gap-0.5 mb-4">
            <label className="text-sm text-gray-700">Date</label>
            <DatePicker date={date} setDate={handleDateChange} />
            {errors.date && (
              <p className="text-sm text-red-500">{errors.date}</p>
            )}
          </div>
          <div className="flex gap-2 mb-6">
            <div>
              <label className="text-sm text-gray-700">From</label>
              <TimePicker
                selectedTime={fromTime}
                setSelectedTime={handleFromTimeChange}
              />
              {errors.fromTime && (
                <p className="mt-0.5 text-xs text-red-500">{errors.fromTime}</p>
              )}
            </div>
            <div>
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
        </Drawer>
      )}
    </>
  );
};

export default AddPeriodForm;
