import {
  BookOpenText,
  CreditCard,
  GraduationCap,
  Users,
  Boxes,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  name: string;
  icon: LucideIcon;
  href: string;
}

/** Always-visible priority destinations (mobile bottom bar). */
export const PRIMARY_LINKS: NavLink[] = [
  { name: "Lessons", icon: BookOpenText, href: "/lessons" },
  { name: "Students", icon: Users, href: "/students" },
  { name: "Income", icon: DollarSign, href: "/income" },
];

/** Secondary destinations (mobile "More" sheet). */
export const SECONDARY_LINKS: NavLink[] = [
  { name: "Cards", icon: CreditCard, href: "/cards" },
  { name: "Teachers", icon: GraduationCap, href: "/teachers" },
  { name: "Teams", icon: Boxes, href: "/teams" },
];

/** Full list for the desktop sidebar — priority items first, then the rest. */
export const LINKS: NavLink[] = [...PRIMARY_LINKS, ...SECONDARY_LINKS];
