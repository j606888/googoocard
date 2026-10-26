import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  /** 已付款、已綁定 */
  positive: "bg-primary-100 text-primary-900",
  /** 需續約、快用完 */
  warning: "bg-warning-100 text-warning-950",
  /** 未付 $X、已過期 */
  danger: "bg-danger-50 text-danger-700",
  /** 已封存、已停用 */
  neutral: "bg-neutral-100 text-neutral-600",
  /** Where something came from: 自助簽到、體驗報名 */
  outline: "bg-white text-primary-900 border border-primary-300",
} as const;

export type StatusTone = keyof typeof TONES;

/**
 * A small status pill (docs/design-system.md「狀態標籤」): 22px tall, fully rounded,
 * 12px semibold, always a tint + dark text pair. Dance-style badges are not this —
 * they stay on `danceStyleMeta()`.
 */
export default function StatusTag({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
