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
      <label className="text-sm font-medium text-neutral-700">Dance Type</label>
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
                  : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
              {style.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-danger-500 text-sm">{error}</p>}
    </div>
  );
};

export default CardDanceTypeSelect;
