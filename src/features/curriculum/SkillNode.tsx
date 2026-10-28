import { Check } from "lucide-react";
import type { TalkMark } from "@/domains/curriculum/talk";
import type { Skill, SkillCategory } from "@/store/slices/curriculum";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS } from "./categoryIcons";
import { categoryVars } from "./categoryColors";
import type { SkillCategoryIcon } from "@/domains/curriculum/skillTree";

/**
 * 樹上的一個技能（teach-what 的樣子）：分類色圓框＋圖示，下面是名稱；左上角的金色泡泡是留言數
 * （討論中＝金色、有結論＝灰色勾、有新留言＝右上藍點）。`selected`＝抽屜正打開它。
 */
export default function SkillNode({
  skill,
  category,
  mark,
  dimmed,
  selected = false,
  onOpen,
}: {
  skill: Skill;
  category: SkillCategory | null;
  mark: TalkMark | undefined;
  dimmed: boolean;
  selected?: boolean;
  onOpen: () => void;
}) {
  const Icon = CATEGORY_ICONS[category?.icon as SkillCategoryIcon] ?? CATEGORY_ICONS.star;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected || undefined}
      aria-label={`${skill.fullName || skill.name}${mark ? `，${mark.count} 則留言${mark.fresh ? "，有新的" : ""}${mark.concluded ? "，有結論" : ""}` : ""}`}
      style={categoryVars(category?.color)}
      className={cn(
        "group flex cursor-pointer flex-col items-center rounded-xl border-[1.5px] px-1 pt-3 pb-2 transition-opacity",
        selected ? "border-neutral-900 bg-[#F1EEFF]" : "border-transparent hover:bg-neutral-50",
        dimmed && !selected && "opacity-35 hover:opacity-100"
      )}
    >
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full border-2 border-(--sf) bg-white text-(--si) transition-transform group-hover:scale-105 [&_svg]:size-5">
        <Icon />
        {mark && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -top-2 -left-3 inline-flex h-[19px] min-w-5 items-center justify-center gap-0.5 rounded-[10px_10px_10px_3px] px-1.5 text-[11px] leading-none font-bold shadow-[0_0_0_2px_white]",
              mark.concluded ? "bg-neutral-200 text-neutral-700" : "bg-[#F2B632] text-[#4A3305]"
            )}
          >
            {mark.concluded && <Check className="size-2.5! stroke-3" />}
            {mark.count}
            {mark.fresh && (
              <span className="absolute -top-[3px] -right-[3px] size-2 rounded-full bg-[#2E6A8E] shadow-[0_0_0_2px_white]" />
            )}
          </span>
        )}
      </span>
      <span className="mt-1.5 line-clamp-2 text-center text-xs leading-[1.3] font-medium text-neutral-900">{skill.name}</span>
    </button>
  );
}
