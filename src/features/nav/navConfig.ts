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
  Settings,
} from "lucide-react";

export interface NavLink {
  /** Display label. Identity is `href` — never match on this. */
  name: string;
  icon: LucideIcon;
  href: string;
}

/** Always-visible priority destinations (mobile bottom bar). */
export const PRIMARY_LINKS: NavLink[] = [
  { name: "課程", icon: BookOpenText, href: "/lessons" },
  { name: "學生", icon: Users, href: "/students" },
  { name: "收入", icon: DollarSign, href: "/income" },
];

/** Other everyday destinations: under the primary ones on desktop, the "More" sheet on mobile. */
export const SECONDARY_LINKS: NavLink[] = [
  { name: "行事曆", icon: CalendarDays, href: "/calendar" },
  { name: "課卡", icon: CreditCard, href: "/cards" },
  { name: "老師", icon: GraduationCap, href: "/teachers" },
];

/**
 * 教室設定: set up once, rarely touched. One entry in the nav; the pages keep
 * their own URLs and share a tab bar (`app/(main)/(settings)/layout.tsx`).
 */
export const SETTINGS_LINKS: NavLink[] = [
  { name: "舞種", icon: Music, href: "/dance-styles" },
  { name: "分部", icon: MapPin, href: "/locations" },
  { name: "團隊", icon: Boxes, href: "/teams" },
  { name: "簽到 QR", icon: QrCode, href: "/checkin-qr" },
];

export const SETTINGS_ENTRY = { name: "教室設定", icon: Settings, href: SETTINGS_LINKS[0].href };
export const ACCOUNT_LINK: NavLink = { name: "帳號", icon: UserCog, href: "/account" };

export const isSettingsPath = (pathname: string) =>
  SETTINGS_LINKS.some((link) => pathname.startsWith(link.href));
