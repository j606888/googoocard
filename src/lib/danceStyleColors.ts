import type { DanceStyleSummary, PaletteColor } from "@/lib/danceStyles";

// Tailwind classes behind each dance style palette key. Tailwind only ships
// classes it finds as literal strings in the source, so every class is spelled
// out here rather than built from the key.
//
// green / orange are the app's own primary / warning scales — what Bachata and
// Salsa have always looked like.

export type DanceStyleClasses = {
  bg: string;
  light: string;
  text: string;
  border: string;
  badge: string;
  dot: string;
};

export const DANCE_STYLE_PALETTE: Record<PaletteColor, DanceStyleClasses> = {
  green: {
    bg: "bg-primary-500",
    light: "bg-primary-50",
    text: "text-primary-700",
    border: "border-primary-400",
    badge: "bg-primary-100 text-primary-700",
    dot: "bg-primary-500",
  },
  orange: {
    bg: "bg-warning-500",
    light: "bg-warning-100",
    text: "text-warning-900",
    border: "border-warning-600",
    badge: "bg-warning-100 text-warning-900",
    dot: "bg-warning-500",
  },
  slate: {
    bg: "bg-slate-500",
    light: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-400",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
  stone: {
    // 500, not 400: white text on stone-400 was too faint.
    bg: "bg-stone-500",
    light: "bg-stone-50",
    text: "text-stone-700",
    border: "border-stone-400",
    badge: "bg-stone-100 text-stone-700",
    dot: "bg-stone-500",
  },
  purple: {
    bg: "bg-purple-500",
    light: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-400",
    badge: "bg-purple-100 text-purple-700",
    dot: "bg-purple-500",
  },
  blue: {
    bg: "bg-blue-500",
    light: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-400",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  pink: {
    bg: "bg-pink-500",
    light: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-400",
    badge: "bg-pink-100 text-pink-700",
    dot: "bg-pink-500",
  },
  teal: {
    bg: "bg-teal-600",
    light: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-400",
    badge: "bg-teal-100 text-teal-700",
    dot: "bg-teal-600",
  },
  red: {
    bg: "bg-red-500",
    light: "bg-red-50",
    text: "text-red-700",
    border: "border-red-400",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
  indigo: {
    bg: "bg-indigo-500",
    light: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-400",
    badge: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
  },
  // Teacher-only cool colours (EXTRA_PALETTE_COLORS).
  sky: {
    bg: "bg-sky-500",
    light: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-400",
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
  },
  cyan: {
    bg: "bg-cyan-600",
    light: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-400",
    badge: "bg-cyan-100 text-cyan-700",
    dot: "bg-cyan-600",
  },
  emerald: {
    bg: "bg-emerald-600",
    light: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-600",
  },
  periwinkle: {
    bg: "bg-indigo-400",
    light: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-400",
    badge: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-400",
  },
  violet: {
    bg: "bg-violet-500",
    light: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-400",
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
  },
  navy: {
    bg: "bg-blue-800",
    light: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-400",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-800",
  },
  plum: {
    bg: "bg-purple-800",
    light: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-400",
    badge: "bg-purple-100 text-purple-700",
    dot: "bg-purple-800",
  },
  midnight: {
    bg: "bg-slate-800",
    light: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-400",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-800",
  },
};

/** For a lesson with no style yet (legacy rows until the contract migration)
 * or a palette key this build doesn't know. */
const NEUTRAL: DanceStyleClasses = {
  bg: "bg-gray-400",
  light: "bg-gray-50",
  text: "text-gray-600",
  border: "border-gray-300",
  badge: "bg-gray-100 text-gray-600",
  dot: "bg-gray-400",
};

export const UNSET_DANCE_STYLE_LABEL = "未設定舞種";

export function danceStyleClasses(color: string | null | undefined): DanceStyleClasses {
  return (color && DANCE_STYLE_PALETTE[color as PaletteColor]) || NEUTRAL;
}

/** Label + classes for a style, or a neutral placeholder when there is none. */
export function danceStyleMeta(
  style: Pick<DanceStyleSummary, "name" | "color"> | null | undefined
): DanceStyleClasses & { label: string } {
  return {
    label: style?.name ?? UNSET_DANCE_STYLE_LABEL,
    ...danceStyleClasses(style?.color),
  };
}
