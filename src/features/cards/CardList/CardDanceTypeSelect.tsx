import { DanceType } from "@prisma/client";
import { ALL_DANCE_TYPES, DANCE_TYPE_META } from "@/lib/danceTypes";

const CardDanceTypeSelect = ({
  value,
  onChange,
  error,
  optional = false,
}: {
  value: DanceType | null;
  onChange: (value: DanceType | null) => void;
  error?: string;
  /** When true (general cards), the dance type is a category label and can be cleared. */
  optional?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1 text-sm font-medium text-neutral-700">
        舞種
        {optional ? (
          <span className="text-neutral-400 font-normal">（選填）</span>
        ) : (
          <>
            <span className="text-danger-500">*</span>
            <span className="text-xs text-neutral-400 font-normal">複習卡必填</span>
          </>
        )}
      </label>
      {optional && (
        <p className="text-xs text-neutral-400 -mt-1">
          分類用標籤，不限制一般卡能用在哪種課
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {ALL_DANCE_TYPES.map((type) => {
          const style = DANCE_TYPE_META[type];
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              // Optional (general) cards can toggle a selection back off to null.
              onClick={() => onChange(selected && optional ? null : type)}
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
