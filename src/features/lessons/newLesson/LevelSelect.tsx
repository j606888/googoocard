import { DANCE_LEVELS } from "@/lib/danceLevels";
import { FieldLabel } from "@/components/Field";

// Segmented 初階/中階/進階. Defaults to 初階, so classrooms that never split
// levels can ignore it — practice cards only care once a lesson is above 初階.
const LevelSelect = ({
  level,
  onChange,
}: {
  level: number;
  onChange: (value: number) => void;
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>階級</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {DANCE_LEVELS.map(({ value, label }) => {
          const selected = level === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={`h-11 px-3 rounded-xl border-[1.5px] text-sm font-medium transition-colors cursor-pointer
                ${selected
                  ? "bg-primary-100 border-primary-700 text-primary-900 font-semibold"
                  : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-300"
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-500">複習卡只能用在學生已完成階級以內的課</p>
    </div>
  );
};

export default LevelSelect;
