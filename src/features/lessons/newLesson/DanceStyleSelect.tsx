import Link from "next/link";
import Select from "react-select";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";

/** Where a classroom manages its dance styles (built in S4 of the dance-styles plan). */
export const DANCE_STYLES_PAGE = "/dance-styles";

/** Shown instead of a picker when the classroom has no dance styles yet. */
export const NoDanceStylesNotice = ({ label = "舞種" }: { label?: string }) => (
  <div className="flex flex-col gap-1">
    <label className="block font-medium mb-1">{label}</label>
    <div className="rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-sm text-neutral-600">
      還沒有舞種 →{" "}
      <Link href={DANCE_STYLES_PAGE} className="font-medium text-primary-700 underline">
        前往新增
      </Link>
    </div>
  </div>
);

const DanceStyleSelect = ({
  danceStyleId,
  onChange,
  error,
}: {
  danceStyleId: number | null;
  onChange: (value: number) => void;
  error?: string;
}) => {
  const isExpanded = useSizeClass() === "expanded";
  const { styles, byId, isLoading } = useDanceStyles();

  // Archived styles aren't offered, except the one an old lesson already has —
  // editing that lesson must not silently change its style.
  const current = danceStyleId !== null ? byId.get(danceStyleId) : undefined;
  const choices = current && current.archivedAt ? [...styles, current] : styles;

  if (!isLoading && choices.length === 0) return <NoDanceStylesNotice />;

  const options = choices.map((style) => ({ label: style.name, value: style.id }));

  return (
    <div className="flex flex-col gap-1">
      <label className="block font-medium mb-1">舞種</label>

      {isExpanded ? (
        /* 桌面：按鈕式 radio group */
        <div className="grid grid-cols-2 gap-2">
          {choices.map((style) => {
            const meta = danceStyleMeta(style);
            const selected = danceStyleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onChange(style.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer
                  ${selected
                    ? `${meta.light} ${meta.border} ${meta.text}`
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
              >
                <span className={`w-3 h-3 rounded-full shrink-0 ${meta.bg}`} />
                {meta.label}
              </button>
            );
          })}
        </div>
      ) : (
        /* 手機：react-select 下拉 */
        <Select
          value={options.find((o) => o.value === danceStyleId) ?? null}
          options={options}
          placeholder="選擇舞種"
          onChange={(option) => option && onChange(option.value)}
        />
      )}
      {error && <p className="text-danger-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default DanceStyleSelect;
