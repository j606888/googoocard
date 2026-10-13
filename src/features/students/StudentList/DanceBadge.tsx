import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { DanceLevels } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { DEFAULT_DANCE_LEVEL, danceLevelLabel } from "@/lib/danceLevels";
import { useDanceStyles } from "@/hooks/useDanceStyles";

/**
 * A dance style as a coloured text pill, with the completed level when the
 * style has levels.
 *
 * - `short` (lists): the name's first two characters + the level's first
 *   character — 「Ba 中」「國標 初」. Styles sharing a first letter (Bachata /
 *   Breaking) no longer collide the way the old one-letter dot did.
 * - `full` (headers): 「Bachata 中階」.
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
  variant?: "short" | "full";
}) => {
  const meta = danceStyleMeta(style);
  const levelLabel = style.hasLevels ? danceLevelLabel(level) : null;
  const name = variant === "short" ? Array.from(style.name).slice(0, 2).join("") : style.name;
  const levelText = levelLabel && (variant === "short" ? levelLabel.charAt(0) : levelLabel);
  const fullLabel = levelLabel ? `${style.name} ${levelLabel}` : style.name;
  return (
    <span
      title={fullLabel}
      className={`inline-flex shrink-0 items-baseline gap-0.5 rounded-md font-semibold whitespace-nowrap ${meta.badge} ${
        variant === "short" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
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
  variant?: "short" | "full";
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
