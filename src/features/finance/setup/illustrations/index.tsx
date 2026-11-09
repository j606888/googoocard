import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Kiwi from "./Kiwi";

/** Shared stroke props for the line work. */
const line = {
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
const PAPER = "fill-[#FFFDF7]";

const Ground = () => <path d="M8 105H152" className="stroke-neutral-200" {...line} />;

const Branches = () => (
  <>
    {[14, 114].map((x, i) => (
      <g key={x}>
        <path d={`M${x + 16} 66V104`} className="stroke-neutral-400" {...line} strokeWidth={3} />
        <rect x={x} y={44} width={32} height={22} rx={4} className={cn(i ? "fill-warning-100 stroke-warning-500" : "fill-primary-100 stroke-primary-600")} {...line} />
        <path d={`M${x + 7} 52H${x + 25}M${x + 7} 58H${x + 19}`} className={i ? "stroke-warning-500" : "stroke-primary-600"} {...line} />
      </g>
    ))}
    <Kiwi x={48} y={55} />
  </>
);

const LessonBranches = () => (
  <>
    <rect x={78} y={26} width={66} height={48} rx={6} className={cn(PAPER, "stroke-primary-300")} {...line} />
    <path d="M88 40H130M88 50H120M88 60H112" className="stroke-neutral-300" {...line} />
    <path d="M72 34h18l6 7-6 7H72z" className="fill-warning-400 stroke-warning-600" {...line} />
    <circle cx={78} cy={41} r={2} className="fill-[#FFFDF7]" />
    <Kiwi x={10} y={55} />
  </>
);

const Venues = () => (
  <>
    <rect x={94} y={20} width={46} height={85} rx={3} className="fill-neutral-100 stroke-neutral-400" {...line} />
    <rect x={104} y={30} width={26} height={18} rx={2} className="fill-primary-100 stroke-neutral-400" {...line} />
    <circle cx={131} cy={66} r={2.5} className="fill-warning-500" />
    <circle cx={78} cy={50} r={6} className="stroke-warning-600" fill="none" {...line} />
    <path d="M84 50H96M92 50v5M88 50v4" className="stroke-warning-600" {...line} />
    <rect x={20} y={22} width={34} height={18} rx={3} transform="rotate(-10 37 31)" className="fill-warning-100 stroke-warning-500" {...line} />
    <path d="M44 20l2 19" className="stroke-warning-500" {...line} strokeDasharray="2 3" />
    <Kiwi x={18} y={55} />
  </>
);

const Rules = () => (
  <>
    <path d="M112 58V28A30 30 0 0 1 138 73Z" className="fill-warning-400 stroke-[#FFFDF7]" {...line} />
    <path d="M112 62l26 15A30 30 0 0 1 86 77Z" className="fill-warning-300 stroke-[#FFFDF7]" {...line} />
    <path d="M112 58L86 73A30 30 0 0 1 112 28Z" className="fill-warning-200 stroke-[#FFFDF7]" {...line} />
    <path d="M72 30l20 20" className="stroke-neutral-400" {...line} strokeWidth={3} />
    <path d="M66 24l5 5" className="stroke-warning-800" {...line} strokeWidth={5} />
    <Kiwi x={8} y={55} />
  </>
);

const pouch = (x: number) =>
  `M${x} 104q-6-24 10-32l-4-8h20l-4 8q16 8 10 32z`;

const Receivers = () => (
  <>
    <path d={pouch(14)} className="fill-primary-100 stroke-primary-600" {...line} />
    <path d={pouch(118)} className="fill-warning-100 stroke-warning-600" {...line} />
    <path d="M30 56Q80 6 134 56" className="stroke-neutral-300" fill="none" {...line} strokeDasharray="3 5" />
    {[
      [56, 34],
      [82, 26],
      [108, 34],
    ].map(([cx, cy]) => (
      <circle key={cx} cx={cx} cy={cy} r={6} className="fill-warning-400 stroke-warning-600" {...line} />
    ))}
    <Kiwi x={52} y={62} w={54} />
  </>
);

const Cash = () => (
  <>
    {[0, 1, 2, 3, 4].map((i) => (
      <ellipse key={i} cx={120} cy={99 - i * 8} rx={18} ry={5} className="fill-warning-400 stroke-warning-600" {...line} />
    ))}
    <circle cx={128} cy={34} r={7} className="fill-warning-300 stroke-warning-600" {...line} />
    <path d="M24 26v12M30 26v12M36 26v12M42 26v12M20 36l26-8" className="stroke-neutral-400" {...line} />
    <Kiwi x={22} y={55} />
  </>
);

const Payables = () => (
  <>
    <rect x={96} y={22} width={44} height={62} rx={4} className={cn(PAPER, "stroke-neutral-400")} {...line} />
    <rect x={108} y={17} width={20} height={9} rx={2} className="fill-neutral-400" />
    <path d="M104 40l3 3 5-6M116 40h16M104 54l3 3 5-6M116 54h16M104 68h28" className="stroke-primary-600" {...line} />
    <rect x={66} y={24} width={24} height={18} rx={2} transform="rotate(8 78 33)" className="fill-warning-100 stroke-warning-500" {...line} />
    <path d="M71 31h13M71 36h8" className="stroke-warning-500" {...line} />
    <Kiwi x={18} y={55} />
  </>
);

const Opening = () => (
  <>
    <path d="M106 100Q84 92 58 96V52Q84 46 106 56Q128 46 154 52V96Q128 92 106 100Z" className="fill-primary-700" />
    <path d="M106 56Q86 44 62 48V92Q86 88 106 96ZM106 56Q126 44 150 48V92Q126 88 106 96Z" className={cn(PAPER, "stroke-primary-700")} {...line} />
    <path d="M70 60Q84 57 98 62M70 70Q84 67 98 72M114 62Q128 57 142 60M114 72Q128 67 142 70" className="stroke-primary-300" fill="none" {...line} />
    <path d="M136 10l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className="fill-warning-400" />
    <path d="M120 22l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" className="fill-warning-300" />
    <Kiwi x={2} y={61} w={56} />
  </>
);

const SCENES: Record<string, () => ReactNode> = {
  branches: Branches,
  lessonBranches: LessonBranches,
  venues: Venues,
  rules: Rules,
  receivers: Receivers,
  cash: Cash,
  payables: Payables,
  opening: Opening,
};

/** Decorative kiwi scene for one 開帳 wizard step (160×120); null for unknown steps. */
export function StepIllustration({ step, className }: { step: string; className?: string }) {
  const Scene = Object.hasOwn(SCENES, step) ? SCENES[step] : undefined;
  if (!Scene) return null;
  return (
    <svg viewBox="0 0 160 120" fill="none" aria-hidden="true" focusable="false" className={cn("h-auto w-40", className)}>
      <circle cx={80} cy={62} r={52} className="fill-primary-50" />
      <Ground />
      <Scene />
    </svg>
  );
}

export default StepIllustration;
