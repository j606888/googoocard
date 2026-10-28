"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";

/**
 * 技能樹的抽屜：標題、會捲的內容、可選的底部按鈕列（`Drawer` 一定有送出鈕，這裡沒有）。
 * 桌面從右邊滑出，手機從下方。
 */
export default function Panel({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ResponsiveDialog open={open} onClose={onClose} desktop="side" className="p-0 max-lg:max-h-[85vh]">
      <div className="flex items-start gap-3 border-b border-neutral-200 px-5 pt-5 pb-3 lg:px-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">{title}</ResponsiveDialogTitle>
          {subtitle && <p className="text-[13px] text-neutral-500">{subtitle}</p>}
        </div>
        <Button variant="ghost" size="iconSm" className="-mr-1 text-neutral-500" onClick={onClose} aria-label="關閉">
          <X className="size-5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:px-6 lg:py-5">{children}</div>
      {footer && <div className="border-t border-neutral-200 px-5 py-3 lg:px-6">{footer}</div>}
    </ResponsiveDialog>
  );
}
