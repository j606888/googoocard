import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

// Generate time options from 00:00 to 23:45 in 15-minute intervals
export const generateTimeOptions = () => {
  const options: Option[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      // 24-hour format value
      const value = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;

      // Convert to 12-hour format for label
      let displayHour = hour;
      let period = "上午"; // AM

      if (hour === 0) {
        displayHour = 12;
      } else if (hour > 12) {
        displayHour = hour - 12;
        period = "下午"; // PM
      } else if (hour === 12) {
        period = "下午"; // PM
      }

      const label = `${period} ${displayHour}:${minute
        .toString()
        .padStart(2, "0")}`;

      options.push({ label, value });
    }
  }

  return options;
};

export type Option = {
  label: string;
  value: string;
}

/** 時段分頁：開始時（含）～ 結束時（不含），以小時計。 */
const PERIODS = [
  { key: "morning", label: "早上", from: 6, to: 11 },
  { key: "noon", label: "中午", from: 11, to: 14 },
  { key: "afternoon", label: "下午", from: 14, to: 18 },
  { key: "evening", label: "晚上", from: 18, to: 24 },
  { key: "night", label: "凌晨", from: 0, to: 6 },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

const hourOf = (value: string) => Number(value.slice(0, 2));

const periodOf = (value: string): PeriodKey =>
  PERIODS.find((p) => hourOf(value) >= p.from && hourOf(value) < p.to)!.key;

/** 分頁已經說明是早上還是晚上，格子裡只顯示「7:30」。 */
const shortLabel = (option: Option) => option.label.split(" ")[1];

/**
 * 時間選擇：上面切早上／中午／下午／晚上／凌晨，下面是該時段每 15 分鐘一格。
 * 沒選過時預設停在「晚上」——多數課都在晚上。
 */
const TimePicker = ({
  selectedTime,
  setSelectedTime,
}: {
  selectedTime: Option | null;
  setSelectedTime: (time: Option | null) => void;
}) => {
  const timeOptions = generateTimeOptions();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("evening");

  const handleOpenChange = (next: boolean) => {
    if (next) setPeriod(selectedTime ? periodOf(selectedTime.value) : "evening");
    setOpen(next);
  };

  const handleTimeSelect = (option: Option) => {
    setSelectedTime(option);
    setOpen(false);
  };

  const current = PERIODS.find((p) => p.key === period)!;
  const visible = timeOptions.filter(
    (o) => hourOf(o.value) >= current.from && hourOf(o.value) < current.to
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger>
        <input
          className={cn(fieldControlClass(), "h-12 cursor-pointer", !selectedTime?.label && "text-neutral-400")}
          value={selectedTime?.label || "選擇時間"}
          readOnly
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <div role="group" aria-label="時段" className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={p.key === period}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 rounded-lg py-1.5 text-sm cursor-pointer transition-colors ${
                p.key === period
                  ? "bg-white text-neutral-900 font-semibold shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 max-h-60 overflow-y-auto">
          {visible.map((option) => {
            const selected = selectedTime?.value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                aria-label={option.label}
                onClick={() => handleTimeSelect(option)}
                className={`h-9 rounded-lg text-sm tabular-nums cursor-pointer transition-colors ${
                  selected
                    ? "bg-primary-900 text-white font-semibold"
                    : option.value.endsWith(":00")
                      ? "text-neutral-900 font-medium hover:bg-primary-50"
                      : "text-neutral-600 hover:bg-primary-50"
                }`}
              >
                {shortLabel(option)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TimePicker;
