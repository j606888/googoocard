"use client";

import { useState } from "react";
import { toast } from "sonner";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import Select from "@/components/Select";
import Field, { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { ENTRY_CATEGORIES, ENTRY_CATEGORY_KEYS, type EntryCategory } from "@/domains/finance/money";
import {
  useCreateEntryMutation,
  useUpdateEntryMutation,
  type FinanceUser,
  type VaultEntryRow,
} from "@/store/slices/finance";
import { DateInput, MoneyInput } from "../ui";
import { dateKeyOf, errorText, parseMoneyInput, todayKey } from "../format";

const OTHER = -1; // 付給不是成員的人（例如 24steps）
const NOBODY = 0;

/** 記一筆／改一筆大水庫的帳。改的時候要寫原因。只有營收負責人看得到這個。 */
export default function EntryDialog({ open, onClose, members, editing }: { open: boolean; onClose: () => void; members: FinanceUser[]; editing?: VaultEntryRow }) {
  const [date, setDate] = useState(editing ? dateKeyOf(editing.date) : todayKey());
  const [category, setCategory] = useState<EntryCategory>(editing?.category ?? "VENUE");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [payee, setPayee] = useState<number>(editing?.payee?.id ?? (editing?.payeeName ? OTHER : NOBODY));
  const [payeeName, setPayeeName] = useState(editing?.payeeName ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [create, creating] = useCreateEntryMutation();
  const [update, updating] = useUpdateEntryMutation();
  const isIncome = ENTRY_CATEGORIES[category].sign > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseMoneyInput(amount);
    if (!value) return setError("填金額");
    if (editing && !reason.trim()) return setError("改帳要寫原因");
    const entry = {
      date,
      category,
      amount: value,
      payeeUserId: payee > 0 ? payee : null,
      payeeName: payee === OTHER ? payeeName.trim() || null : null,
      description: description.trim() || null,
    };
    try {
      if (editing) await update({ id: editing.id, entry, reason: reason.trim() }).unwrap();
      else await create(entry).unwrap();
      toast.success(editing ? "改好了" : "記好了");
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={onClose} className="gap-4 overflow-y-auto p-5">
      <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">{editing ? "改這筆帳" : "記一筆"}</ResponsiveDialogTitle>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="entry-category">分類</FieldLabel>
          <Select<EntryCategory>
            id="entry-category"
            value={category}
            onChange={setCategory}
            options={ENTRY_CATEGORY_KEYS.map((k) => ({
              value: k,
              label: ENTRY_CATEGORIES[k].label,
              hint: ENTRY_CATEGORIES[k].sign > 0 ? "進大水庫" : "從大水庫出去",
            }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="entry-amount" hint={isIncome ? "（進來的錢）" : "（出去的錢）"}>
            金額
          </FieldLabel>
          <MoneyInput id="entry-amount" value={amount} onChange={setAmount} autoFocus={!editing} error={!!error && !parseMoneyInput(amount)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="entry-date">日期</FieldLabel>
          <DateInput id="entry-date" value={date} onChange={setDate} />
        </div>
        {!isIncome && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="entry-payee" hint="（選填）">
              付給誰
            </FieldLabel>
            <Select<number>
              id="entry-payee"
              value={payee}
              onChange={setPayee}
              options={[
                { value: NOBODY, label: "不用記" },
                ...members.map((m) => ({ value: m.id, label: m.name })),
                { value: OTHER, label: "其他（填名字）" },
              ]}
            />
            {payee === OTHER && (
              <input
                aria-label="付給誰的名字"
                maxLength={60}
                placeholder="例如 24steps"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                className={`${fieldControlClass()} h-12`}
              />
            )}
          </div>
        )}
        <Field label="說明" hint="（選填）" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如 10/30 台南兩堂" />
        {editing && <Field label="為什麼要改" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如 金額打錯" />}
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" isLoading={creating.isLoading || updating.isLoading}>
            {editing ? "儲存" : "記下來"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
