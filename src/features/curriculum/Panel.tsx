"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";

/** A dialog with a title and a scrolling body, no submit button (`Drawer` always has one). */
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
    <ResponsiveDialog open={open} onClose={onClose} className="max-h-[85vh] p-0 lg:max-w-[560px]">
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">{title}</ResponsiveDialogTitle>
          {subtitle && <p className="text-[13px] text-neutral-500">{subtitle}</p>}
        </div>
        <Button variant="ghost" size="iconSm" className="-mr-1 text-neutral-500" onClick={onClose} aria-label="關閉">
          <X className="size-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      {footer && <div className="border-t border-neutral-200 px-5 py-3">{footer}</div>}
    </ResponsiveDialog>
  );
}
