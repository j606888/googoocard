"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * 一顆 ⓘ：說明文字收在點開的小浮層裡，畫面上不常駐（介面越乾淨越好）。
 * `label` 是按鈕的無障礙名稱，例如「複習卡說明」。
 */
export default function InfoTip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 cursor-pointer hover:text-neutral-800 hover:bg-neutral-100",
            className
          )}
        >
          <Info className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 text-[13px] leading-relaxed text-neutral-700">
        {children}
      </PopoverContent>
    </Popover>
  );
}
