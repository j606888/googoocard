"use client";

import ResponsiveDialog, { ResponsiveDialogTitle } from "./ResponsiveDialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) => (
  <ResponsiveDialog
    open={open}
    onClose={onCancel}
    className="min-h-0 max-w-sm p-6"
  >
    <ResponsiveDialogTitle className="text-base font-semibold mb-1.5">
      {title}
    </ResponsiveDialogTitle>
    <p className="text-sm text-neutral-500 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
      >
        取消
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading}
        className="px-4 py-2 text-sm rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"
      >
        {isLoading ? "處理中…" : confirmLabel}
      </button>
    </div>
  </ResponsiveDialog>
);

export default ConfirmDialog;
