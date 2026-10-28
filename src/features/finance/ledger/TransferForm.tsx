"use client";

import { useId, useState } from "react";
import { ArrowDown, Info } from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Select from "@/components/Select";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Money, { moneyText } from "../Money";
import { DEFAULT_HOLDER, currentUser, fundHolders, period, shortDateFromISO, stampNow } from "../mockData";
import type { FundHolder, Transfer, TransferMethod } from "../types";
import { LabeledControl, OptionCard } from "../ui";

/** 轉移送出的內容；編號由流水帳補上。 */
export type NewTransfer = Omit<Transfer, "id">;

const holderOf = (name: string) => fundHolders.find((h) => h.name === name) as FundHolder;

function useTransferForm(onSave: (transfer: NewTransfer) => void) {
  const [from, setFrom] = useState(DEFAULT_HOLDER);
  const [to, setTo] = useState(() => fundHolders.find((h) => h.name !== DEFAULT_HOLDER)!.name);
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<TransferMethod>("cash");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(period.todayISO);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  const amount = Number(amountText.replace(/[,\s]/g, "")) || 0;
  const source = holderOf(from);
  const target = holderOf(to);

  const changeFrom = (next: string) => {
    setFrom(next);
    // 從和交給不能是同一個
    if (next === to) setTo(fundHolders.find((h) => h.name !== next)!.name);
    setError(undefined);
  };

  const reset = () => {
    setAmountText("");
    setRef("");
    setNote("");
    setError(undefined);
  };

  /** 送出；成功回 true。 */
  const submit = (): boolean => {
    if (amount <= 0) {
      setError("請輸入大於 0 的金額");
      return false;
    }
    if (amount > source.balance) {
      setError(`${source.name}手上只有 NT$${moneyText(source.balance)}`);
      return false;
    }
    onSave({
      date: shortDateFromISO(date),
      from,
      to,
      fromBranch: source.branch,
      toBranch: target.branch,
      receiver: target.keeper,
      amount,
      method,
      ref: method === "bank" ? ref.trim() || undefined : undefined,
      note: note.trim() || undefined,
      sent: stampNow(),
    });
    toast.success(`（示意）已送出，等${target.keeper}確認收到`);
    reset();
    return true;
  };

  return {
    from,
    changeFrom,
    to,
    setTo,
    source,
    target,
    amount,
    amountText,
    setAmountText: (value: string) => {
      setAmountText(value);
      setError(undefined);
    },
    method,
    setMethod,
    ref,
    setRef,
    date,
    setDate,
    note,
    setNote,
    error,
    submit,
  };
}

type TransferFormState = ReturnType<typeof useTransferForm>;

function TransferFields({ form }: { form: TransferFormState }) {
  const id = useId();
  const control = cn(fieldControlClass(), "h-12");
  const holderOption = (h: FundHolder) => ({
    value: h.name,
    label: `${h.branch} · ${h.name}`,
    hint: `手上 NT$${moneyText(h.balance)}`,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1.5 rounded-2xl bg-primary-50 p-3">
          <div className="flex justify-between text-[13px] text-primary-900">
            <label htmlFor={`${id}-from`}>從</label>
            <span>
              手上 NT$<Money value={form.source.balance} />
            </span>
          </div>
          <Select id={`${id}-from`} value={form.from} onChange={form.changeFrom} options={fundHolders.map(holderOption)} />
        </div>
        <ArrowDown aria-hidden="true" className="mx-auto size-5 text-primary-700" />
        <div className="flex flex-col gap-1.5 rounded-2xl bg-primary-900 p-3">
          <div className="flex justify-between text-[13px] text-primary-100">
            <label htmlFor={`${id}-to`}>交給</label>
            <span>
              手上 NT$<Money value={form.target.balance} />
            </span>
          </div>
          <Select
            id={`${id}-to`}
            value={form.to}
            onChange={form.setTo}
            options={fundHolders.filter((h) => h.name !== form.from).map(holderOption)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={`${id}-amount`}>金額</FieldLabel>
        <div className={cn(fieldControlClass(!!form.error), "flex h-16 items-center gap-2")}>
          <span className="text-base text-neutral-500">NT$</span>
          <input
            id={`${id}-amount`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={form.amountText}
            onChange={(e) => form.setAmountText(e.target.value)}
            aria-invalid={form.error ? true : undefined}
            aria-describedby={form.error ? `${id}-error` : undefined}
            className="w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </div>
        <FieldError id={`${id}-error`}>{form.error}</FieldError>
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={() => form.setAmountText(String(form.source.balance))}>
            全部 {moneyText(form.source.balance)}
          </Button>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-neutral-900">怎麼交</legend>
        <div className="grid grid-cols-2 gap-2">
          <OptionCard selected={form.method === "cash"} title="現金面交" hint="見面時直接給" onSelect={() => form.setMethod("cash")} />
          <OptionCard selected={form.method === "bank"} title="銀行轉帳" hint="記下末五碼" onSelect={() => form.setMethod("bank")} />
        </div>
      </fieldset>

      {form.method === "bank" && (
        <LabeledControl label="帳號末五碼" htmlFor={`${id}-ref`}>
          <input
            id={`${id}-ref`}
            inputMode="numeric"
            className={control}
            placeholder="例：38211"
            value={form.ref}
            onChange={(e) => form.setRef(e.target.value)}
          />
        </LabeledControl>
      )}

      <div className="grid grid-cols-2 gap-3">
        <LabeledControl label="日期" htmlFor={`${id}-date`}>
          <input id={`${id}-date`} type="date" className={control} value={form.date} onChange={(e) => form.setDate(e.target.value)} />
        </LabeledControl>
        <LabeledControl label={<>為什麼轉<span className="ml-1 font-normal text-neutral-500">（選填）</span></>} htmlFor={`${id}-note`}>
          <input
            id={`${id}-note`}
            className={control}
            placeholder="例：場租週轉"
            value={form.note}
            onChange={(e) => form.setNote(e.target.value)}
          />
        </LabeledControl>
      </div>

      {form.amount > 0 && form.amount <= form.source.balance && (
        <section aria-label="轉移之後" className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4 text-[15px]">
          <span className="text-[13px] font-medium text-neutral-600">轉移之後</span>
          <AfterRow name={form.source.name} before={form.source.balance} after={form.source.balance - form.amount} />
          <AfterRow name={form.target.name} before={form.target.balance} after={form.target.balance + form.amount} />
        </section>
      )}

      <p className="flex gap-2 rounded-xl bg-warning-50 px-3.5 py-3 text-sm leading-relaxed text-warning-950">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          送出後要{form.target.keeper}按「確認收到」才算完成。在那之前這筆顯示「等{form.target.keeper}確認」。
        </span>
      </p>
    </div>
  );
}

function AfterRow({ name, before, after }: { name: string; before: number; after: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="truncate text-neutral-700">{name}</span>
      <span className="shrink-0 tabular-nums text-neutral-600">
        <Money value={before} /> → <Money value={after} className="font-bold text-neutral-900" />
      </span>
    </div>
  );
}

/** 「轉移」按下去才打開：把一批錢從一個人手上交給另一個人。 */
export function TransferFormDrawer({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (transfer: NewTransfer) => void;
}) {
  const form = useTransferForm(onSave);
  const save = () => {
    if (form.submit()) onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      onSubmit={save}
      title="轉移資金"
      subtitle={`記錄人：${currentUser}。不算收入也不算支出，送出和確認的時間都會記下。`}
      secondaryText="取消"
      submitText="送出轉移"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="pb-4"
      >
        <TransferFields form={form} />
      </form>
    </Drawer>
  );
}
