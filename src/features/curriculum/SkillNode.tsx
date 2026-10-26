import { Check, MessageCircle } from "lucide-react";
import type { TalkMark } from "@/domains/curriculum/talk";
import type { Skill, SkillCategory } from "@/store/slices/curriculum";
import { cn } from "@/lib/utils";
import { CategoryMark } from "./categoryIcons";

/** 樹上的一個技能：分類色的圓＋圖示＋名稱，右邊留言數（有新的換提醒色）。 */
export default function SkillNode({
  skill,
  category,
  mark,
  dimmed,
  onOpen,
}: {
  skill: Skill;
  category: SkillCategory | null;
  mark: TalkMark | undefined;
  dimmed: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left transition-[opacity,border-color] hover:border-primary-300",
        dimmed && "opacity-40"
      )}
    >
      <CategoryMark category={category} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium text-neutral-900">{skill.name}</span>
        {skill.fullName && <span className="truncate text-xs text-neutral-500">{skill.fullName}</span>}
      </span>
      {mark && (
        <span
          aria-label={`${mark.count} 則留言${mark.fresh ? "，有新的" : ""}${mark.concluded ? "，有結論" : ""}`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            mark.fresh ? "bg-warning-100 text-warning-950" : "bg-neutral-100 text-neutral-600"
          )}
        >
          {mark.concluded ? <Check className="size-3" /> : <MessageCircle className="size-3" />}
          {mark.count}
        </span>
      )}
    </button>
  );
}
