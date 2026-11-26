import type { ReactNode } from "react";
import KiwiMascot, { type KiwiPose } from "./KiwiMascot";
import { cn } from "@/lib/utils";

/** 淺色圓底上的奇異鳥：「第一次使用」空狀態的插圖，姿勢由呼叫端依內容挑。 */
const KiwiIllustration = ({ pose }: { pose: KiwiPose }) => (
  <div aria-hidden="true" className="relative w-[200px] h-[168px]">
    <div className="absolute left-5 top-2 size-40 rounded-full bg-primary-50" />
    <KiwiMascot
      pose={pose}
      className="absolute left-1/2 top-1/2 h-[140px] w-[164px] -translate-x-1/2 -translate-y-1/2 object-contain"
    />
  </div>
);

/**
 * The one empty state, three kinds:
 * - `page` — nothing exists yet (還沒有課程): kiwi illustration, one-line why, the primary action.
 *   Pick a `pose` that fits what is missing (dance for 舞種, card for 課卡…); default `card`.
 * - `filtered` — a search/filter matched nothing: a small puzzled kiwi, how to recover, usually 「清除篩選」.
 * - `inline` — an empty section inside a list or tab (還沒有出席紀錄): one unboxed ink-3 line;
 *   give it a `variant="text"` Button as `action`.
 * No tinted background box. Put the action in `action` (a `Button`); `page` wants `size="md"` on
 * desktop and full-width `size="lg"` on phones — the caller decides.
 */
export default function EmptyState({
  kind = "page",
  title,
  description,
  action,
  icon,
  pose,
  className,
}: {
  kind?: "page" | "filtered" | "inline";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** `inline` only: a lucide icon element; defaults to none. */
  icon?: ReactNode;
  /** `page` / `filtered` only: which kiwi to draw. */
  pose?: KiwiPose;
  className?: string;
}) {
  if (kind === "inline") {
    return (
      <div className={cn("flex min-h-12 items-center gap-3 py-2.5", className)}>
        {icon && (
          <span aria-hidden="true" className="shrink-0 text-ink-3 [&_svg]:size-[18px]">
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm text-ink-3">{title}</p>
          {description && <p className="text-[13px] text-ink-3">{description}</p>}
        </div>
        {action}
      </div>
    );
  }

  if (kind === "filtered") {
    return (
      <div className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}>
        <KiwiMascot pose={pose ?? "confused"} className="h-[76px] w-auto" />
        <p className="text-base font-bold text-ink">{title}</p>
        {description && <p className="text-sm text-ink-2">{description}</p>}
        {action}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-5 px-6 py-12 text-center", className)}>
      <KiwiIllustration pose={pose ?? "card"} />
      <div className="flex flex-col items-center gap-2">
        <p className="text-xl font-bold text-ink">{title}</p>
        {description && (
          <p className="max-w-[340px] text-[15px] leading-relaxed text-ink-2">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
