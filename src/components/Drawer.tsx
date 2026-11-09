"use client";

import { X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import ResponsiveDialog, { ResponsiveDialogTitle } from "./ResponsiveDialog";

interface BottomSheetDialogProps {
  open: boolean;
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  submitText?: string;
  disabled?: boolean;
  /** "danger" paints the submit button red — for destructive confirmations. */
  variant?: "primary" | "danger";
  /**
   * A second, outlined button left of submit — usually 取消. Without it the
   * submit button stays full width, as before.
   */
  secondaryText?: string;
  onSecondary?: () => void;
  /**
   * Shown at the footer's left, before the buttons — a total (購買課卡的合計)
   * or a quiet destructive link (封存學生).
   */
  footerStart?: React.ReactNode;
  /** A line under the title, e.g. who this is for. */
  subtitle?: string;
  /**
   * "wide": on desktop (lg:) a much wider dialog with a taller scroll area, and the
   * footer right-aligned with an auto-width submit button. Mobile is unchanged.
   */
  size?: "default" | "wide";
}

/**
 * 有主張的對話框：標題列 ＋ 內容 ＋ 一顆送出按鈕。
 * 遮罩、定位、動畫、focus 管理全部交給 `ResponsiveDialog`。
 */
const Drawer = ({
  title,
  open,
  onClose,
  onSubmit,
  children,
  isLoading,
  disabled = false,
  submitText = "建立",
  variant = "primary",
  secondaryText,
  onSecondary,
  footerStart,
  subtitle,
  size = "default",
}: BottomSheetDialogProps) => {
  const wide = size === "wide";
  return (
    <ResponsiveDialog open={open} onClose={onClose} className={wide ? "lg:max-w-4xl" : undefined}>
      <div className="relative flex flex-col items-center justify-center mb-6 px-11">
        <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900 text-center">
          {title}
        </ResponsiveDialogTitle>
        {subtitle && <p className="mt-0.5 text-center text-[13px] text-neutral-500">{subtitle}</p>}
        <Button
          variant="ghost"
          size="iconSm"
          className="absolute -right-1 -top-1.5 text-neutral-500"
          onClick={onClose}
          aria-label="關閉"
        >
          <X className="size-5" />
        </Button>
      </div>
      <div className={cn("max-h-[60vh] overflow-y-auto px-1 -mx-1 pb-1", wide && "lg:max-h-[70vh]")}>{children}</div>
      <div className={cn("mt-auto w-full flex items-center gap-2 pt-5", wide && "lg:justify-end")}>
        {footerStart && <div className="shrink-0 mr-1">{footerStart}</div>}
        {secondaryText && (
          <Button
            type="button"
            variant="secondary"
            className={cn("flex-1", wide && "lg:flex-none lg:px-6")}
            onClick={onSecondary ?? onClose}
          >
            {secondaryText}
          </Button>
        )}
        <Button
          disabled={disabled}
          type="submit"
          variant={variant}
          isLoading={isLoading}
          className={cn(
            "mt-auto",
            secondaryText ? "flex-[2]" : footerStart ? "flex-1" : "w-full",
            wide && "lg:w-auto lg:flex-none lg:px-8"
          )}
          onClick={() => !isLoading && onSubmit()}
        >
          {submitText}
        </Button>
      </div>
    </ResponsiveDialog>
  );
};

export default Drawer;
