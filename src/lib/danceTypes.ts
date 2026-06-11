import { DanceType } from "@prisma/client";

// Single place to register a new dance type for the UI: label + visual styles.
// 2-color palette: primary (teal) + warning (orange); ZOUK and HUSTLE use
// neutral slate/stone to stay calm visually.
export const DANCE_TYPE_META = {
  BACHATA: {
    label: "Bachata",
    bg: "bg-primary-500",
    light: "bg-primary-50",
    text: "text-primary-700",
    border: "border-primary-400",
    badge: "bg-primary-100 text-primary-700",
    dot: "bg-primary-500",
  },
  SALSA: {
    label: "Salsa",
    bg: "bg-warning-500",
    light: "bg-warning-100",
    text: "text-warning-900",
    border: "border-warning-600",
    badge: "bg-warning-100 text-warning-900",
    dot: "bg-warning-500",
  },
  ZOUK: {
    label: "Zouk",
    bg: "bg-slate-500",
    light: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-400",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
  HUSTLE: {
    label: "Hustle",
    bg: "bg-stone-400",
    light: "bg-stone-50",
    text: "text-stone-700",
    border: "border-stone-300",
    badge: "bg-stone-100 text-stone-700",
    dot: "bg-stone-400",
  },
  KIZOMBA: {
    label: "Kizomba",
    bg: "bg-purple-500",
    light: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-400",
    badge: "bg-purple-100 text-purple-700",
    dot: "bg-purple-500",
  },
} as const satisfies Record<
  DanceType,
  {
    label: string;
    bg: string;
    light: string;
    text: string;
    border: string;
    badge: string;
    dot: string;
  }
>;

export const ALL_DANCE_TYPES = Object.keys(DANCE_TYPE_META) as DanceType[];

export const danceTypeLabel = (type: DanceType) => DANCE_TYPE_META[type].label;
