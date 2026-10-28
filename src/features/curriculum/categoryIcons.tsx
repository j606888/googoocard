import {
  Footprints,
  Heart,
  Lightbulb,
  Music,
  Sparkles,
  Star,
  Target,
  Users,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { SkillCategoryIcon } from "@/domains/curriculum/skillTree";
import { cn } from "@/lib/utils";
import { CATEGORY_ON_FILL, categoryColor } from "./categoryColors";

export const CATEGORY_ICONS: Record<SkillCategoryIcon, LucideIcon> = {
  lightbulb: Lightbulb,
  footprints: Footprints,
  waves: Waves,
  zap: Zap,
  users: Users,
  target: Target,
  sparkles: Sparkles,
  music: Music,
  heart: Heart,
  star: Star,
};

/** A 分類's colour chip with its icon (dark icon on the fill). `square` = the tab marker on the tree. */
export function CategoryMark({
  category,
  size = "md",
  shape = "circle",
  className,
}: {
  category: { color: string; icon: string } | null;
  size?: "sm" | "md";
  shape?: "circle" | "square";
  className?: string;
}) {
  const Icon = category ? (CATEGORY_ICONS[category.icon as SkillCategoryIcon] ?? Star) : Star;
  return (
    <span
      aria-hidden="true"
      style={{ background: categoryColor(category?.color).fill, color: CATEGORY_ON_FILL }}
      className={cn(
        "grid shrink-0 place-items-center [&_svg]:stroke-[2.2]",
        shape === "square" ? "rounded-[7px]" : "rounded-full",
        size === "sm" ? "size-[26px] [&_svg]:size-3.5" : "size-8 [&_svg]:size-4",
        className
      )}
    >
      <Icon />
    </span>
  );
}
