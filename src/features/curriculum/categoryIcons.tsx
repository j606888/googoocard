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
import { danceStyleClasses } from "@/lib/danceStyleColors";
import { cn } from "@/lib/utils";

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

/** A 分類's colour disc with its icon — the node marker on the tree. */
export function CategoryMark({
  category,
  size = "md",
  className,
}: {
  category: { color: string; icon: string } | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = category ? (CATEGORY_ICONS[category.icon as SkillCategoryIcon] ?? Star) : Star;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-white",
        category ? danceStyleClasses(category.color).bg : "bg-neutral-300",
        size === "sm" ? "size-5 [&_svg]:size-3" : "size-8 [&_svg]:size-4",
        className
      )}
    >
      <Icon />
    </span>
  );
}
