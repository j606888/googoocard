import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { DanceLevels } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { DEFAULT_DANCE_LEVEL, practiceQualificationLabel } from "@/lib/danceLevels";
import { useDanceStyles } from "@/hooks/useDanceStyles";

/**
 * The style's first letter in its colour. Styles sharing a letter (Bachata /
 * Breaking) are told apart by colour. A levelled style above 初階 carries the
 * level number in the top-right corner.
 */
const DanceBadge = ({
  style,
  level = DEFAULT_DANCE_LEVEL,
}: {
  style: DanceStyleSummary;
  level?: number;
}) => {
  const meta = danceStyleMeta(style);
  const showLevel = style.hasLevels && level > DEFAULT_DANCE_LEVEL;
  return (
    <div className="relative w-6 h-6 shrink-0" title={practiceQualificationLabel(style, level)}>
      <div
        className={`w-6 h-6 ${meta.bg} text-white rounded-full flex items-center justify-center text-sm font-semibold`}
      >
        {meta.label.charAt(0)}
      </div>
      {showLevel && (
        <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 box-border rounded-full bg-neutral-900 text-white border-2 border-white flex items-center justify-center text-[10px] font-bold leading-none">
          {level}
        </span>
      )}
    </div>
  );
};

/** One badge per qualified dance style, in the classroom's style order. */
export const DanceBadges = ({ levels }: { levels: DanceLevels | undefined }) => {
  const { byId } = useDanceStyles();
  if (!levels || Object.keys(levels).length === 0) return null;
  return (
    <>
      {[...byId.values()]
        .filter((style) => levels[style.id] !== undefined)
        .map((style) => (
          <DanceBadge key={style.id} style={style} level={levels[style.id]} />
        ))}
    </>
  );
};

export default DanceBadge;
