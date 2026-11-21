import type { CSSProperties } from "react";
import {
  danceStyleAbbreviation,
  HEX_COLOR_RE,
  type DanceStyleSummary,
  type PaletteColor,
} from "@/lib/danceStyles";

// Tailwind classes behind each dance style palette key. Tailwind only ships
// classes it finds as literal strings in the source, so every class is spelled
// out here rather than built from the key.
//
// green is the app's primary scale; orange has its own dance-orange-* tokens,
// deliberately apart from warning-* (amber = 要處理).

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
    bg: "bg-dance-orange-500",
    light: "bg-dance-orange-100",
    text: "text-dance-orange-900",
    border: "border-dance-orange-600",
    badge: "bg-dance-orange-100 text-dance-orange-900",
    dot: "bg-dance-orange-500",
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

/** Teachers' palette classes (teachers only pick palette keys). Dance styles
 * may carry a custom hex, so they go through `danceStyleMeta()` instead. */
export function danceStyleClasses(color: string | null | undefined): DanceStyleClasses {
  return (color && DANCE_STYLE_PALETTE[color as PaletteColor]) || NEUTRAL_CLASSES;
}

const NEUTRAL_CLASSES: DanceStyleClasses = {
  bg: "bg-gray-400",
  light: "bg-gray-50",
  text: "text-gray-600",
  border: "border-gray-300",
  badge: "bg-gray-100 text-gray-600",
  dot: "bg-gray-400",
};

// ── Dance styles: palette key or custom hex → inline styles ─────────────────

/** The solid colour behind each palette key (the `bg` class above). */
export const PALETTE_HEX: Record<PaletteColor, string> = {
  green: "#55bd95",
  orange: "#f4a15e",
  slate: "#64748b",
  stone: "#78716c",
  purple: "#a855f7",
  blue: "#3b82f6",
  pink: "#ec4899",
  teal: "#0d9488",
  red: "#ef4444",
  indigo: "#6366f1",
  sky: "#0ea5e9",
  cyan: "#0891b2",
  emerald: "#059669",
  periwinkle: "#818cf8",
  violet: "#8b5cf6",
  navy: "#1e40af",
  plum: "#6b21a8",
  midnight: "#1e293b",
};

const NEUTRAL_HEX = "#9ca3af";

/** A style's `color` (palette key or `#rrggbb`) as a hex; gray when unknown. */
export function danceStyleHex(color: string | null | undefined): string {
  if (!color) return NEUTRAL_HEX;
  if (HEX_COLOR_RE.test(color)) return color;
  return PALETTE_HEX[color as PaletteColor] ?? NEUTRAL_HEX;
}

/** sRGB hex → OKLCH ([0..1], chroma, hue°). */
function hexToOklch(hex: string): [number, number, number] {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

const oklch = (l: number, c: number, h: number) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

export type DanceStyleTones = {
  /** The solid colour — dots, bars, filled blocks. */
  fill: CSSProperties;
  /** Text/icons drawn on `fill` (white, or dark ink on a light custom colour). */
  onFill: CSSProperties;
  /** A very pale background (old `light`). */
  tint: CSSProperties;
  /** Readable text in the style's hue (old `text`). */
  ink: CSSProperties;
  /** A border in the style's hue (old `border`). */
  edge: CSSProperties;
  /** Pale chip with ink text (old `badge`). */
  chip: CSSProperties;
};

const tonesCache = new Map<string, DanceStyleTones>();

/** Every tone a dance style needs, derived from one colour so a custom hex
 * gets the same pale/ink variants the palette keys always had. */
export function danceStyleTones(color: string | null | undefined): DanceStyleTones {
  const hex = danceStyleHex(color);
  const cached = tonesCache.get(hex);
  if (cached) return cached;
  const [L, C, H] = hexToOklch(hex);
  const c = Math.min(C, 0.16);
  const ink = oklch(Math.min(L, 0.5), Math.min(C, 0.14), H);
  const tones: DanceStyleTones = {
    fill: { backgroundColor: hex },
    onFill: { color: L > 0.78 ? oklch(0.3, c, H) : "#fff" },
    tint: { backgroundColor: oklch(0.975, c * 0.18, H) },
    ink: { color: ink },
    edge: { borderColor: oklch(Math.max(Math.min(L + 0.1, 0.8), 0.6), c * 0.8, H) },
    chip: { backgroundColor: oklch(0.94, c * 0.35, H), color: ink },
  };
  tonesCache.set(hex, tones);
  return tones;
}

export const UNSET_DANCE_STYLE_LABEL = "未設定舞種";

/** Label, abbreviation and inline-style tones for a style, or a neutral
 * placeholder when there is none. Use `style={meta.fill}` etc. */
export function danceStyleMeta(
  style: Pick<DanceStyleSummary, "name" | "color"> & { abbreviation?: string | null } | null | undefined
): DanceStyleTones & { label: string; abbr: string; hex: string } {
  return {
    label: style?.name ?? UNSET_DANCE_STYLE_LABEL,
    abbr: danceStyleAbbreviation(style),
    hex: danceStyleHex(style?.color),
    ...danceStyleTones(style?.color),
  };
}
