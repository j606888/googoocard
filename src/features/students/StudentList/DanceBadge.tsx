import type { DanceStyleSummary } from "@/lib/danceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { useDanceStyles } from "@/hooks/useDanceStyles";

const DanceBadge = ({ style }: { style: DanceStyleSummary }) => {
  const meta = danceStyleMeta(style);
  return (
    <div
      className={`w-6 h-6 ${meta.bg} text-white rounded-full flex items-center justify-center text-sm font-semibold`}
      title={meta.label}
    >
      {meta.label.charAt(0)}
    </div>
  );
};

/** One badge per qualified dance style, in the classroom's style order. */
export const DanceBadges = ({ styleIds }: { styleIds: number[] | undefined }) => {
  const { byId } = useDanceStyles();
  if (!styleIds?.length) return null;
  return (
    <>
      {[...byId.values()]
        .filter((style) => styleIds.includes(style.id))
        .map((style) => (
          <DanceBadge key={style.id} style={style} />
        ))}
    </>
  );
};

export default DanceBadge;
