import { DANCE_LEVELS } from "@/lib/danceLevels";

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
    <div className="flex flex-col gap-1">
      <label className="block font-medium mb-1">階級</label>
      <div className="grid grid-cols-3 gap-2">
        {DANCE_LEVELS.map(({ value, label }) => {
          const selected = level === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer
                ${selected
                  ? "bg-primary-50 border-primary-500 text-primary-700"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
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
