"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field, { FieldError, FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { cn } from "@/lib/utils";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useCreateExpenseMutation } from "@/store/slices/finance";
import { financeErrorText, todayKey } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

const CATEGORIES = ["廣告", "海報", "飲料", "宵夜", "慶功宴", "其他"];

/** 記一筆支出：從哪個分部的公積金出、誰先墊的。 */
export default function ExpenseForm({
  open,
  onClose,
  selfOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  /** 保管人（不能結算）：付款人固定是自己。 */
  selfOnly?: boolean;
}) {
  const { data } = useGetLocationsQuery();
  const { options: payers, defaultUserId, meId } = useFinanceMembers();
  const [create, { isLoading }] = useCreateExpenseMutation();
  const locations = (data?.locations ?? []).filter((l) => !l.archivedAt);

  const [date, setDate] = useState(todayKey());
  const [amount, setAmount] = useState("");
  const [locationId, setLocationId] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // 每次打開都回到預設，不留上一次填的內容
  useEffect(() => {
    if (!open) return;
    setDate(todayKey());
    setAmount("");
    setLocationId(null);
    setCategory("");
    setPaidBy(null);
    setNote("");
    setError("");
  }, [open]);

  const loc = locationId ?? locations[0]?.id ?? null;
  // 保管人（不能結算）付款人固定是自己
  const payer = selfOnly ? (meId ?? 0) : (paidBy ?? defaultUserId);
  const amountNum = Number(amount);
  const valid = Number.isInteger(amountNum) && amountNum > 0 && !!loc && !!category.trim() && !!payer && !!date;

  const submit = async () => {
    setError("");
    try {
      await create({
        date,
        amount: amountNum,
        locationId: loc!,
        category: category.trim(),
        paidByUserId: payer,
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap();
      toast.success("已記下這筆支出");
      setAmount("");
      setNote("");
      setCategory("");
      onClose();
    } catch (e) {
      setError(financeErrorText(e, "記不下來，請再試一次"));
    }
  };

  return (
    <Drawer
      title="記一筆支出"
      open={open}
      onClose={onClose}
      onSubmit={submit}
      submitText="記下"
      isLoading={isLoading}
      disabled={!valid}
    >
      <div className="flex flex-col gap-4">
        <Field label="日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field
          label="金額"
          inputMode="numeric"
          placeholder="500"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>從哪個分部的公積金出</FieldLabel>
          <Select
            value={loc ?? undefined}
            onChange={(v) => setLocationId(v)}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
            placeholder="選分部"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field
            label="類別"
            placeholder="自己輸入，或點下面的"
            value={category}
            maxLength={20}
            onChange={(e) => setCategory(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm cursor-pointer",
                  category === c
                    ? "border-primary-700 bg-primary-100 text-primary-900"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>誰付的</FieldLabel>
          {selfOnly ? (
            <p className="text-sm text-neutral-900">{payers.find((o) => o.value === payer)?.label ?? "自己"}（自己）</p>
          ) : (
            <Select value={payer} onChange={(v) => setPaidBy(v)} options={payers} placeholder="選一位" />
          )}
          {!selfOnly && meId !== null && payer !== meId && !!payer && (
            <p className="text-[13px] text-warning-800">這筆記成 {payers.find((o) => o.value === payer)?.label ?? "別人"} 付的錢</p>
          )}
        </div>
        <Field label="備註" hint="（選填）" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        <FieldError>{error}</FieldError>
      </div>
    </Drawer>
  );
}
