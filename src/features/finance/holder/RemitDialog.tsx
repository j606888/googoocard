"use client";

import { useState } from "react";
import { toast } from "sonner";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import SegmentedTabs from "@/components/SegmentedTabs";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import { Button } from "@/components/ui/button";
import {
  useCreateRemittanceMutation,
  useUpdateRemittanceMutation,
  type PaymentMethod,
  type Remittance,
} from "@/store/slices/finance";
import { DateInput, MoneyInput } from "../ui";
import { dateKeyOf, errorText, money, parseMoneyInput, todayKey } from "../format";

/**
 * 送回主堡（docs/finance-plan.md §5.1「繳回」）。金額預設帶入手上全部；
 * 傳 editing 就是改一筆轉交中的、或被退回的改完重送。
 */
export default function RemitDialog({
  open,
  onClose,
  inHand,
  ownerName,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  inHand: number;
  ownerName: string;
  editing?: Remittance;
}) {
  // 改轉交中的那筆時，它本來的金額也算可以送的。
  const available = inHand + (editing?.status === "PENDING" ? editing.amount : 0);
  const [amount, setAmount] = useState(String(editing?.amount ?? available));
  const [method, setMethod] = useState<PaymentMethod>(editing?.method ?? "CASH");
  const [reference, setReference] = useState(editing?.reference ?? "");
  const [sentOn, setSentOn] = useState(editing ? dateKeyOf(editing.sentOn) : todayKey());
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [create, creating] = useCreateRemittanceMutation();
  const [update, updating] = useUpdateRemittanceMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseMoneyInput(amount);
    if (!value) return setError("填要送的金額");
    if (value > available) return setError(`手上只有 ${money(available)}`);
    const body = { amount: value, method, reference: method === "TRANSFER" ? reference.trim() || null : null, sentOn, note: note.trim() || null };
    try {
      if (editing) await update({ id: editing.id, body }).unwrap();
      else await create(body).unwrap();
      toast.success(editing?.status === "REJECTED" ? "重新送出了" : `出發！${ownerName} 確認後就會入庫`);
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={onClose} className="gap-4 p-5">
      <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">
        {editing ? (editing.status === "REJECTED" ? "改完重新送出" : "修改這筆繳回") : "送回主堡"}
      </ResponsiveDialogTitle>
      {editing?.status === "REJECTED" && editing.rejectReason && (
        <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">退回原因：{editing.rejectReason}</p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="remit-amount" hint={`手上 ${money(available)}`}>
            金額
          </FieldLabel>
          <MoneyInput id="remit-amount" value={amount} onChange={setAmount} error={!!error} ariaDescribedBy="remit-error" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">怎麼交</span>
          <SegmentedTabs<PaymentMethod>
            ariaLabel="怎麼交"
            fill
            value={method}
            onChange={setMethod}
            options={[
              { value: "CASH", label: "現金" },
              { value: "TRANSFER", label: "轉帳" },
            ]}
          />
        </div>
        {method === "TRANSFER" && (
          <Field label="轉帳末五碼" hint="（選填）" inputMode="numeric" maxLength={10} value={reference} onChange={(e) => setReference(e.target.value)} />
        )}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="remit-date">交錢的日子</FieldLabel>
          <DateInput id="remit-date" value={sentOn} max={todayKey()} onChange={setSentOn} />
        </div>
        <Field label="備註" hint="（選填）" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        <FieldError id="remit-error">{error}</FieldError>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" isLoading={creating.isLoading || updating.isLoading}>
            {editing ? "送出" : "出發！"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
