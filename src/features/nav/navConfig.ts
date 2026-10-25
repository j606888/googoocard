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

/** Secondary destinations (mobile "More" sheet). */
export const SECONDARY_LINKS: NavLink[] = [
  { name: "行事曆", icon: CalendarDays, href: "/calendar" },
  { name: "課卡", icon: CreditCard, href: "/cards" },
  { name: "簽到 QR", icon: QrCode, href: "/checkin-qr" },
  { name: "老師", icon: GraduationCap, href: "/teachers" },
  { name: "舞種", icon: Music, href: "/dance-styles" },
  { name: "分部", icon: MapPin, href: "/locations" },
  { name: "團隊", icon: Boxes, href: "/teams" },
  { name: "帳號", icon: UserCog, href: "/account" },
];

/** Full list for the desktop sidebar — priority items first, then the rest. */
export const LINKS: NavLink[] = [...PRIMARY_LINKS, ...SECONDARY_LINKS];
