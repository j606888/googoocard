import AddButton from "@/components/AddButton";
import Drawer from "@/components/Drawer";
import InputField from "@/components/InputField";
import { useState } from "react";


const validationErrors = {
  empty: "Can not be empty",
  toTimeMustGreater: "Must greater than From",
};

const validateForm = (data: { date: string; fromTime: string; toTime: string }) => {
  const errors: { date?: string; fromTime?: string; toTime?: string } = {
  };
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
  if (data.fromTime >= data.toTime) {
    errors.toTime = validationErrors.toTimeMustGreater;
  }
  return errors;
};

const AddPeriodForm = ({ onAddPeriod }: { onAddPeriod: (period: { date: string, fromTime: string, toTime: string }) => void }) => {
  const [newPeriodModalOpen, setNewPeriodModalOpen] = useState(false);
  const [date, setDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [errors, setErrors] = useState<{ date?: string; fromTime?: string; toTime?: string }>({});

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.date) {
      setErrors({...errors, date: undefined});
    }
    setDate(e.target.value);
  };

  const handleFromTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.fromTime) {
      setErrors({...errors, fromTime: undefined});
    }
    const fromTime = e.target.value;
    setFromTime(fromTime);
    const [fromHour, fromMinute] = fromTime.split(":");
    const toHour = parseInt(fromHour) + 1;
    const toMinute = fromMinute;
    setToTime(`${toHour}:${toMinute}`);
  };

  const handleToTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.toTime && e.target.value > fromTime) {
      setErrors({...errors, toTime: undefined});
      return;
    }
    setToTime(e.target.value);
  };

  const handleSubmit = () => {
    const errors = validateForm({date, fromTime, toTime});
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }

    onAddPeriod({date, fromTime, toTime});
    setNewPeriodModalOpen(false);
    setDate("");
    const dateObj = new Date(date)
    const oneWeekLater = new Date(dateObj)
    oneWeekLater.setDate(dateObj.getDate() + 7)
    const newDateStr = oneWeekLater.toISOString().slice(0, 10) // "2025-06-12"
    setDate(newDateStr);
  };

  return (
    <>
      <AddButton onClick={() => setNewPeriodModalOpen(true)}>
        New Period
      </AddButton>
      {newPeriodModalOpen && (
        <Drawer
          open={newPeriodModalOpen}
          onClose={() => setNewPeriodModalOpen(false)}
          onSubmit={handleSubmit}
          title="New Period"
        >
          <form className="mb-10">
            <InputField
              label="Date"
              value={date}
              type="date"
              className="mb-4 pr-4"
              placeholder="E.g. 2025/5/27"
              onChange={handleDateChange}
              error={errors.date}
              />
            <div className="flex gap-4">
              <InputField
                label="From"
                type="time"
                className="pr-4"
                value={fromTime}
                onChange={handleFromTimeChange}
                error={errors.fromTime}
              />
              <InputField
                label="To"
                type="time"
                className="pr-4"
                value={toTime}
                onChange={handleToTimeChange}
                error={errors.toTime}
              />
            </div>
          </form>
        </Drawer>
      )}
    </>
  );
};

export default AddPeriodForm;
