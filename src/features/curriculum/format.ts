import { sorted, tierName } from "@/domains/curriculum/skillTree";
import type { Skill, SkillCategory, SkillTier } from "@/store/slices/curriculum";

/** 「剛剛」「5 分鐘前」「3 天前」, then the date. */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const d = new Date(iso);
  return d.getFullYear() === new Date(now).getFullYear()
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 「二轉 · Lv2」— tiers are named by position. */
export function tierText(tiers: SkillTier[], tierId: number | null): string | null {
  const list = sorted(tiers);
  const index = list.findIndex((t) => t.id === tierId);
  if (index < 0) return null;
  return list[index].label ? `${tierName(index)} · ${list[index].label}` : tierName(index);
}

/** Where a skill sits, in words: 「單人腳步 · 二轉」, 「待定 · 還沒放進樹」, 「已從樹上移除」. */
export function placeText(skill: Skill, categories: SkillCategory[], tiers: SkillTier[]): string {
  if (skill.archivedAt) return "已從樹上移除";
  if (skill.categoryId === null) {
    const tier = tierText(tiers, skill.tierId);
    return tier ? `待定 · ${tier}` : "待定 · 還沒放進樹";
  }
  const category = categories.find((c) => c.id === skill.categoryId);
  return [category?.name, tierText(tiers, skill.tierId)].filter(Boolean).join(" · ");
}
