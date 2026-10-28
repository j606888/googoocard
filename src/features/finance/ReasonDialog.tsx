"use client";

import { useState } from "react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import Field from "@/components/Field";
import { Button } from "@/components/ui/button";
import { errorText } from "./format";

/** 要寫原因才能做的事：退回繳回、作廢一筆帳。 */
export default function ReasonDialog({
  open,
  onClose,
  title,
  description,
  label = "原因",
  confirmLabel,
  danger = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  label?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError("要寫原因");
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={onClose} className="min-h-0 gap-4 p-5">
      <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">{title}</ResponsiveDialogTitle>
      {description && <p className="text-sm text-neutral-600">{description}</p>}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={label} autoFocus maxLength={200} value={reason} error={error} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} isLoading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
