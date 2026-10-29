import { Search } from "lucide-react";
import type { ReactNode } from "react";
import KiwiLogo from "./KiwiLogo";
import { cn } from "@/lib/utils";

/** 奇異鳥＋一張還沒蓋章的課卡：「第一次使用」空狀態的插圖。 */
const KiwiCardIllustration = () => (
  <div aria-hidden="true" className="relative w-[200px] h-[168px]">
    <div className="absolute left-5 top-2 size-40 rounded-full bg-primary-50" />
    <div className="absolute left-[92px] top-10 w-[92px] h-16 rotate-[8deg] rounded-xl border-[1.5px] border-primary-300 bg-[#FFFDF7] p-2.5 grid grid-cols-4 gap-1.5 content-center">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="aspect-square rounded-full border-[1.5px] border-dashed border-primary-300" />
      ))}
    </div>
    <KiwiLogo className="absolute left-7 top-20 w-[104px] text-primary-500" />
  </div>
);

/**
 * The one empty state, three kinds:
 * - `page` — nothing exists yet (還沒有課程): kiwi illustration, one-line why, the primary action.
 * - `filtered` — a search/filter matched nothing: search icon, how to recover, usually 「清除篩選」.
 * - `inline` — an empty section inside a card or tab (還沒有出席紀錄): dashed box, one row.
 * No tinted background box. Put the action in `action` (a `Button`); `page` wants `size="md"` on
 * desktop and full-width `size="lg"` on phones — the caller decides.
 */
export default function EmptyState({
  kind = "page",
  title,
  description,
  action,
  icon,
  className,
}: {
  kind?: "page" | "filtered" | "inline";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** `inline` only: a lucide icon element; defaults to none. */
  icon?: ReactNode;
  className?: string;
}) {
  if (kind === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-neutral-200 p-4",
          className
        )}
      >
        {icon && (
          <span
            aria-hidden="true"
            className="size-9 shrink-0 rounded-full bg-primary-50 text-primary-700 grid place-items-center [&_svg]:size-[18px]"
          >
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          {description && <p className="text-[13px] text-neutral-500">{description}</p>}
        </div>
        {action}
      </div>
    );
  }

  if (kind === "filtered") {
    return (
      <div className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}>
        <span
          aria-hidden="true"
          className="size-12 rounded-full bg-neutral-100 text-neutral-500 grid place-items-center"
        >
          <Search className="size-[22px]" />
        </span>
        <p className="text-base font-bold text-neutral-900">{title}</p>
        {description && <p className="text-sm text-neutral-600">{description}</p>}
        {action}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-5 px-6 py-12 text-center", className)}>
      <KiwiCardIllustration />
      <div className="flex flex-col items-center gap-2">
        <p className="text-xl font-bold text-neutral-900">{title}</p>
        {description && (
          <p className="max-w-[340px] text-[15px] leading-relaxed text-neutral-600">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
