import { Droplets, Network, type LucideIcon } from "lucide-react";
import type { Module } from "@/lib/permissions";

/** What each 功能模組 card on /modules says. */
export const MODULE_INFO: Record<
  Module,
  { name: string; icon: LucideIcon; href: string; summary: string; adds: string; who: string }
> = {
  curriculum: {
    name: "技能樹",
    icon: Network,
    href: "/curriculum",
    summary: "把每個舞種想教的東西排成一棵樹：分類 × 等級 × 技能，還沒想好位置的先丟進待定區。",
    adds: "側欄多一個「技能樹」；每個技能都有留言板，可以 @ 人、標結論。",
    who: "預設所有人都看得到、能留言；管理員和老師能編輯。",
  },
  finance: {
    name: "水庫",
    icon: Droplets,
    href: "/finance",
    summary: "整間教室的錢：收入、場地費、老師費、廣告等支出，錢在誰手上，月結與發薪。",
    adds: "側欄多一個「水庫」。目前是示意畫面，數字是假的，之後才會接上點名與課卡。",
    who: "預設只有管理員看得到；可以在團隊頁個別開給其他人。",
  },
};
