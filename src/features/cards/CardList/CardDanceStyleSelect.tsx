import { useDanceStyles } from "@/hooks/useDanceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { NoDanceStylesNotice } from "@/features/lessons/newLesson/DanceStyleSelect";

const CardDanceStyleSelect = ({
  value,
  onChange,
  error,
  optional = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  /** When true (general cards), the dance style is a category label and can be cleared. */
  optional?: boolean;
}) => {
  const { styles, byId, isLoading } = useDanceStyles();

  // Archived styles aren't offered, except the one this card already has.
  const current = value !== null ? byId.get(value) : undefined;
  const choices = current && current.archivedAt ? [...styles, current] : styles;

  if (!isLoading && choices.length === 0) {
    // A practice card can't be saved without a style, so point the way; for a
    // general card the label is optional and simply has nothing to offer yet.
    return optional ? null : <NoDanceStylesNotice />;
  }

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
        {choices.map((style) => {
          const meta = danceStyleMeta(style);
          const selected = value === style.id;
          return (
            <button
              key={style.id}
              type="button"
              // Optional (general) cards can toggle a selection back off to null.
              onClick={() => onChange(selected && optional ? null : style.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all cursor-pointer ${
                selected
                  ? `${meta.light} ${meta.border} ${meta.text}`
                  : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
              {meta.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-danger-500 text-sm">{error}</p>}
    </div>
  );
};

export default CardDanceStyleSelect;
