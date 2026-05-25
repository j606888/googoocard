// Dance type visual styles — 2-color palette: primary (teal) + warning (orange).
// ZOUK and HUSTLE use neutral slate/stone to stay calm visually.
export const DANCE_TYPE_STYLES = {
  BACHATA: {
    bg: "bg-primary-500",
    light: "bg-primary-50",
    text: "text-primary-700",
    border: "border-primary-400",
    badge: "bg-primary-100 text-primary-700",
    dot: "bg-primary-500",
  },
  SALSA: {
    bg: "bg-warning-500",
    light: "bg-warning-100",
    text: "text-warning-900",
    border: "border-warning-600",
    badge: "bg-warning-100 text-warning-900",
    dot: "bg-warning-500",
  },
  ZOUK: {
    bg: "bg-slate-500",
    light: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-400",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
  HUSTLE: {
    bg: "bg-stone-400",
    light: "bg-stone-50",
    text: "text-stone-700",
    border: "border-stone-300",
    badge: "bg-stone-100 text-stone-700",
    dot: "bg-stone-400",
  },
} as const;
