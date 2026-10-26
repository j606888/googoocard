import {
  BookOpenText,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Users,
  Boxes,
  DollarSign,
  QrCode,
  Music,
  UserCog,
  type LucideIcon,
  MapPin,
  Network,
  Droplets,
  Blocks,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavLink {
  /** Display label. Identity is `href` — never match on this. */
  name: string;
  icon: LucideIcon;
  href: string;
  /** Shown only to members with this permission (`useCan`); a module's permission also hides it while the module is off. */
  permission?: Permission;
}

/** Always-visible priority destinations (mobile bottom bar). */
export const PRIMARY_LINKS: NavLink[] = [
  { name: "課程", icon: BookOpenText, href: "/lessons" },
  { name: "學生", icon: Users, href: "/students" },
  { name: "收入", icon: DollarSign, href: "/income" },
];

/** Secondary destinations (mobile "More" sheet). */
export const SECONDARY_LINKS: NavLink[] = [
  { name: "行事曆", icon: CalendarDays, href: "/calendar" },
  { name: "課卡", icon: CreditCard, href: "/cards" },
  { name: "簽到 QR", icon: QrCode, href: "/checkin-qr" },
  { name: "老師", icon: GraduationCap, href: "/teachers" },
  { name: "舞種", icon: Music, href: "/dance-styles" },
  { name: "分部", icon: MapPin, href: "/locations" },
  { name: "團隊", icon: Boxes, href: "/teams" },
  { name: "功能模組", icon: Blocks, href: "/modules", permission: "modules.manage" },
  { name: "帳號", icon: UserCog, href: "/account" },
];

/** 功能模組 (docs/modules-plan.md) — a group of their own in the sidebar, in the "More" sheet on mobile. */
export const MODULE_LINKS: NavLink[] = [
  { name: "技能樹", icon: Network, href: "/curriculum", permission: "curriculum.view" },
  { name: "水庫", icon: Droplets, href: "/finance", permission: "finance.view" },
];
