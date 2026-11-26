import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { DanceLevels } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { DEFAULT_DANCE_LEVEL, danceLevelLabel } from "@/lib/danceLevels";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import DanceStyleDot from "@/components/DanceStyleDot";

type DanceBadgeVariant = "short" | "full" | "plain";

/**
 * A dance style with the completed level when the style has levels: a
 * coloured text pill, or (`plain`, the roster) an 8px dot + ordinary text.
 *
 * - `short` (lists): the name's first two characters + the level's first
 *   character — 「Ba 中」「國標 初」. Styles sharing a first letter (Bachata /
 *   Breaking) no longer collide the way the old one-letter dot did.
 * - `full` (headers): 「Bachata 中階」.
 * - `plain` (the students roster): the `short` wording as ordinary text after
 *   a `DanceStyleDot`. Colour only says which style; there is no pill.
 *
 * The full wording is always in the tooltip.
 */
const DanceBadge = ({
  style,
  level = DEFAULT_DANCE_LEVEL,
  variant = "short",
}: {
  style: DanceStyleSummary;
  level?: number;
  variant?: DanceBadgeVariant;
}) => {
  const meta = danceStyleMeta(style);
  const levelLabel = style.hasLevels ? danceLevelLabel(level) : null;
  const name = variant === "full" ? style.name : meta.abbr;
  const levelText = levelLabel && (variant === "full" ? levelLabel : levelLabel.charAt(0));
  const fullLabel = levelLabel ? `${style.name} ${levelLabel}` : style.name;
  if (variant === "plain") {
    return (
      <span title={fullLabel} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <DanceStyleDot style={style} />
        <span aria-hidden="true">
          {name}
          {levelText && <span className="ml-0.5 text-ink-3">{levelText}</span>}
        </span>
        <span className="sr-only">{fullLabel}</span>
      </span>
    );
  }
  return (
    <span
      title={fullLabel}
      className={`inline-flex shrink-0 items-baseline gap-0.5 rounded-sm font-semibold whitespace-nowrap ${
        variant === "short" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
      style={meta.chip}
    >
      {name}
      {levelText && <span className="font-medium opacity-90 ml-0.5">{levelText}</span>}
      {variant === "short" && <span className="sr-only">{fullLabel}</span>}
    </span>
  );
};

/** One badge per qualified dance style, in the classroom's style order. */
export const DanceBadges = ({
  levels,
  variant = "short",
}: {
  levels: DanceLevels | undefined;
  variant?: DanceBadgeVariant;
}) => {
  const { byId } = useDanceStyles();
  if (!levels || Object.keys(levels).length === 0) return null;
  return (
    <>
      {[...byId.values()]
        .filter((style) => levels[style.id] !== undefined)
        .map((style) => (
          <DanceBadge key={style.id} style={style} level={levels[style.id]} variant={variant} />
        ))}
    </>
  );
};

export default DanceBadge;
