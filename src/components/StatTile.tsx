import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 一格數字＋一行說明（已上堂數／平均出席／這期收入）。
 * `onPrimary`：放在綠色頁首上；`card`：白底卡片。
 */
const StatTile = ({
  value,
  label,
  tone = "card",
  className,
}: {
  value: ReactNode;
  label: string;
  tone?: "card" | "onPrimary";
  className?: string;
}) => (
  <div
    className={cn(
      "min-w-0 rounded-2xl px-3 py-2.5",
      tone === "onPrimary" ? "bg-white/15 text-white" : "border border-line bg-white text-ink",
      className
    )}
  >
    <dd className="truncate text-xl font-bold tabular-nums">{value}</dd>
    <dt className={cn("truncate text-xs", tone === "onPrimary" ? "text-primary-100" : "text-ink-2")}>
      {label}
    </dt>
  </div>
);

export default StatTile;
