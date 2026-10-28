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
    summary: "公司的錢在哪裡：大家收的課卡錢送回給營收負責人確認，大水庫的進出都記下來。",
    adds: "側欄多一個「水庫」。開了之後先建城（5 題），之後的課卡收款自動帶進來；分帳、月結之後才有。",
    who: "全公開：每個人都看得到所有帳；只有營收負責人能確認繳回、記大水庫的帳。",
  },
};
