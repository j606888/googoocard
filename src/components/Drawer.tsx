"use client";

import { Loader2, X } from "lucide-react";
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
}: BottomSheetDialogProps) => {
  const submitColor =
    variant === "danger"
      ? "bg-danger-500 hover:bg-danger-600"
      : "bg-primary-500 hover:bg-primary-600";

  return (
    <ResponsiveDialog open={open} onClose={onClose}>
      <div className="relative flex items-center justify-center mb-6 ">
        <ResponsiveDialogTitle className="text-xl font-semibold">
          {title}
        </ResponsiveDialogTitle>
        <button
          className="text-neutral-500 absolute right-0 top-0 flex items-center gap-2 cursor-pointer"
          onClick={onClose}
          aria-label="關閉"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">{children}</div>
      <div className="mt-auto w-full">
        <button
          disabled={disabled}
          type="submit"
          className={`mt-auto w-full ${submitColor} text-white font-semibold py-2 rounded flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={() => !isLoading && onSubmit()}
        >
          <span>{submitText}</span>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        </button>
      </div>
    </ResponsiveDialog>
  );
};

export default Drawer;
