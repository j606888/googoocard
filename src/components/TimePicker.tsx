import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useRef, useEffect } from "react";

// Generate time options from 00:00 to 23:45 in 15-minute intervals
export const generateTimeOptions = () => {
  const options = [];

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

const TimePicker = ({
  selectedTime,
  setSelectedTime,
}: {
  selectedTime: Option | null;
  setSelectedTime: (time: Option | null) => void;
}) => {
  const timeOptions = generateTimeOptions();
  const [open, setOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleTimeSelect = (option: { label: string; value: string }) => {
    setSelectedTime(option);
    setOpen(false);
  };

  useEffect(() => {
    if (open) {
      // Add a small delay to ensure the DOM is ready
      setTimeout(() => {
        if (scrollContainerRef.current) {
          console.log("Inside");
          const container = scrollContainerRef.current;
          const selectedIndex = timeOptions.findIndex(
            (option) => option.value === (selectedTime?.value || "12:00")
          );

          if (selectedIndex !== -1) {
            const optionHeight = 36;
            const containerHeight = container.clientHeight;
            const scrollTop =
              selectedIndex * optionHeight -
              containerHeight / 2 +
              optionHeight / 2;

            container.scrollTop = Math.max(0, scrollTop);
          }
        }
      }, 10); // Small delay to ensure DOM is ready
    }
  }, [open, selectedTime, timeOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <input
          className={`text-sm bg-gray-100 rounded-md p-2 w-full cursor-pointer ${selectedTime?.label ? "" : "text-gray-400"}`}
          value={selectedTime?.label || "Pick time"}
          readOnly
        />
      </PopoverTrigger>
      <PopoverContent className="w-40 p-0">
        <div ref={scrollContainerRef} className="max-h-48 overflow-y-scroll">
          {timeOptions.map((option) => (
            <div
              key={option.value}
              className={`px-4 py-2 hover:bg-gray-200 cursor-pointer text-sm text-gray-700 ${
                selectedTime?.value === option.value ? "bg-gray-100" : ""
              }`}
              onClick={() => handleTimeSelect(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TimePicker;
