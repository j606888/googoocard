"use client";

import type { DanceLevels } from "@/domains/qualification";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { DANCE_LEVELS, DEFAULT_DANCE_LEVEL } from "@/lib/danceLevels";
import { useDanceStyles } from "@/hooks/useDanceStyles";

const NOT_DONE = { value: 0, label: "未完成" };
const LEVELED_OPTIONS = [NOT_DONE, ...DANCE_LEVELS];
const UNLEVELED_OPTIONS = [NOT_DONE, { value: DEFAULT_DANCE_LEVEL, label: "已完成" }];

/**
 * Pick a level for one style. 0 = 未完成 (no qualification row). A style
 * without levels only offers 已完成, which keeps whatever level is stored —
 * picking it again must not downgrade a level set while the style still had
 * levels.
 */
export function applyLevelPick(
  prev: DanceLevels,
  styleId: number,
  level: number,
  hasLevels: boolean
): DanceLevels {
  const next = { ...prev };
  if (level === 0) delete next[styleId];
  else if (hasLevels || next[styleId] === undefined) next[styleId] = level;
  return next;
}

/**
 * The styles a qualification editor lists: the classroom's active styles,
 * plus any archived one the student still holds — the PATCH is
 * authoritative, so it must be visible to be removable.
 */
export function useQualificationStyles(levels: DanceLevels): DanceStyleSummary[] {
  const { styles, byId } = useDanceStyles();
  return [
    ...styles,
    ...[...byId.values()].filter((style) => style.archivedAt && levels[style.id] !== undefined),
  ];
}

/**
 * One segmented 未完成／初階／中階／進階 row per dance style. Shared by the
 * edit form (local state, saved on 儲存) and the detail page's side panel
 * (saved on each click). `dense` shortens the labels to one character for
 * the 300px side panel.
 */
const QualificationLevels = ({
  levels,
  onPick,
  dense = false,
  disabled = false,
}: {
  levels: DanceLevels;
  onPick: (styleId: number, level: number, hasLevels: boolean) => void;
  dense?: boolean;
  disabled?: boolean;
}) => {
  const styles = useQualificationStyles(levels);
  const { isLoading: stylesLoading } = useDanceStyles();

  if (styles.length === 0) {
    // 還在載入時別先喊「沒有舞種」
    if (stylesLoading) return <p className="text-sm text-neutral-400">載入中…</p>;
    return <p className="text-sm text-neutral-500">教室還沒有舞種。</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {styles.map((danceStyle) => {
        const meta = danceStyleMeta(danceStyle);
        const current = levels[danceStyle.id] ?? 0;
        const options = danceStyle.hasLevels ? LEVELED_OPTIONS : UNLEVELED_OPTIONS;
        return (
          <div key={danceStyle.id} className="flex items-center gap-3">
            <div className={`${dense ? "w-20" : "w-24"} flex items-center gap-2 shrink-0 min-w-0`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
              <span className="text-sm font-medium truncate" title={meta.label}>
                {meta.label}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={`${meta.label} 已完成階級`}
              className="flex-1 grid gap-0 rounded-xl bg-neutral-100 p-0.5"
              style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
            >
              {options.map((option) => {
                // Without levels any stored level counts as 已完成.
                const checked =
                  option.value === 0
                    ? current === 0
                    : danceStyle.hasLevels
                      ? current === option.value
                      : current > 0;
                const label =
                  dense && danceStyle.hasLevels
                    ? option.value === 0
                      ? "未過"
                      : option.label.charAt(0)
                    : option.label;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={option.label}
                    disabled={disabled}
                    onClick={() => onPick(danceStyle.id, option.value, danceStyle.hasLevels)}
                    className={`${dense ? "h-8 text-xs" : "h-9 text-sm"} rounded-[10px] cursor-pointer transition-colors disabled:cursor-wait ${
                      !checked
                        ? "text-neutral-600"
                        : option.value === 0
                          ? "bg-white text-neutral-800 font-semibold shadow-sm"
                          : "bg-primary-900 text-white font-semibold"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QualificationLevels;
