"use client";

import { Button } from "./ui/button";
import ResponsiveDialog, { ResponsiveDialogTitle } from "./ResponsiveDialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** "danger" paints the confirm button red — for destructive confirmations. */
  variant?: "primary" | "danger";
}

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "確認",
  onConfirm,
  onCancel,
  isLoading,
  variant = "primary",
}: ConfirmDialogProps) => (
  <ResponsiveDialog
    open={open}
    onClose={onCancel}
    className="min-h-0 max-w-sm p-6"
  >
    <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900 mb-1.5">
      {title}
    </ResponsiveDialogTitle>
    <p className="text-sm text-neutral-600 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <Button variant="ghost" onClick={onCancel}>
        取消
      </Button>
      <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
        {isLoading ? "處理中…" : confirmLabel}
      </Button>
    </div>
  </ResponsiveDialog>
);

export default ConfirmDialog;
