import Link from "next/link";
import Select from "react-select";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { FieldError, FieldLabel } from "@/components/Field";

/** Where a classroom manages its dance styles (built in S4 of the dance-styles plan). */
export const DANCE_STYLES_PAGE = "/dance-styles";

/** Shown instead of a picker when the classroom has no dance styles yet. */
export const NoDanceStylesNotice = ({ label = "舞種" }: { label?: string }) => (
  <div className="flex flex-col gap-1.5">
    <FieldLabel>{label}</FieldLabel>
    <EmptyState
      kind="inline"
      title="還沒有舞種"
      action={
        <Button asChild variant="secondary" size="sm">
          <Link href={DANCE_STYLES_PAGE}>前往新增</Link>
        </Button>
      }
    />
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
    <div className="flex flex-col gap-1.5">
      <FieldLabel>舞種</FieldLabel>

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
                className={`flex items-center gap-2.5 h-11 px-3 rounded-xl border-[1.5px] text-sm font-medium transition-colors cursor-pointer
                  ${selected
                    ? `${meta.light} ${meta.border} ${meta.text}`
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-300"
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
      <FieldError>{error}</FieldError>
    </div>
  );
};

export default DanceStyleSelect;
