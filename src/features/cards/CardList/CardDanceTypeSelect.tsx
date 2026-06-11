import { DanceType } from "@prisma/client";
import { ALL_DANCE_TYPES, DANCE_TYPE_META } from "@/lib/danceTypes";

const CardDanceTypeSelect = ({
  value,
  onChange,
  error,
}: {
  value: DanceType | null;
  onChange: (value: DanceType) => void;
  error?: string;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Dance Type</label>
      <div className="flex flex-wrap gap-2">
        {ALL_DANCE_TYPES.map((type) => {
          const style = DANCE_TYPE_META[type];
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all cursor-pointer ${
                selected
                  ? `${style.light} ${style.border} ${style.text}`
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
              {style.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};

export default CardDanceTypeSelect;
