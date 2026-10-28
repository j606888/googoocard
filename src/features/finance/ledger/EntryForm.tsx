"use client";

import { useId, useState } from "react";
import { Camera, Plus } from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import FilterChip from "@/components/FilterChip";
import Select, { textOptions } from "@/components/Select";
import SegmentedTabs from "@/components/SegmentedTabs";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import {
  BRANCHES,
  BRANCH_OPTIONS,
  DEFAULT_HOLDER,
  EXPENSE_CATEGORIES,
  FUND_HOLDERS,
  INCOME_CATEGORIES,
  currentUser,
  monthSessions,
  period,
  shortDateFromISO,
} from "../mockData";
import type { Direction, EntryValues, Transaction } from "../types";
import { LaterAction, LabeledControl } from "../ui";

/** 記一筆送出的內容；編號和「誰、什麼時候記的」由流水帳補上。 */
export type NewEntry = EntryValues & Pick<Transaction, "missingReceipt">;

export const categoriesFor = (direction: Direction) =>
  direction === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

/** 記一筆的狀態與送出。 */
function useEntryForm(onSave: (entry: NewEntry) => void) {
  const [direction, setDirection] = useState<Direction>("income");
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [amountText, setAmountText] = useState("");
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [date, setDate] = useState(period.todayISO);
  const [holder, setHolder] = useState(DEFAULT_HOLDER);
  const [sessionId, setSessionId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  const switchDirection = (next: Direction) => {
    setDirection(next);
    setCategory(categoriesFor(next)[0]);
  };

  /** 送出；成功回 true。 */
  const submit = (): boolean => {
    const amount = Number(amountText.replace(/[,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("請輸入大於 0 的金額");
      return false;
    }
    if (!date) {
      setError("請選日期");
      return false;
    }
    const session = monthSessions.find((s) => s.id === sessionId);
    onSave({
      date: shortDateFromISO(date),
      category,
      description: note.trim() || (session ? `${session.title} · ${session.date}` : category),
      branch,
      holder,
      amount: direction === "income" ? amount : -amount,
      // 示意：還不能附收據，支出一律先標「缺收據」
      missingReceipt: direction === "expense" || undefined,
    });
    toast.success("（示意）已記錄");
    setAmountText("");
    setNote("");
    setSessionId("");
    setError(undefined);
    return true;
  };

  return {
    direction,
    switchDirection,
    category,
    setCategory,
    amountText,
    setAmountText: (value: string) => {
      setAmountText(value);
      setError(undefined);
    },
    branch,
    setBranch,
    date,
    setDate,
    holder,
    setHolder,
    sessionId,
    setSessionId,
    note,
    setNote,
    error,
    submit,
  };
}

type EntryFormState = ReturnType<typeof useEntryForm>;

function EntryFields({ form }: { form: EntryFormState }) {
  const id = useId();

  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs<Direction>
        ariaLabel="收入或支出"
        fill
        value={form.direction}
        onChange={form.switchDirection}
        options={[
          { value: "income", label: "收入" },
          { value: "expense", label: "支出" },
        ]}
      />

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
            className={cn(
              "w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums outline-none placeholder:text-neutral-400",
              form.direction === "income" ? "text-primary-900" : "text-warning-950"
            )}
          />
        </div>
        <FieldError id={`${id}-error`}>{form.error}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-900">類別</span>
        <div role="group" aria-label="類別" className="flex flex-wrap items-center gap-2">
          {categoriesFor(form.direction).map((c) => (
            <FilterChip key={c} active={form.category === c} onClick={() => form.setCategory(c)}>
              {c}
            </FilterChip>
          ))}
          <LaterAction variant="ghost" size="sm">
            <Plus className="size-4" />
            自訂
          </LaterAction>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LabeledControl label="據點" htmlFor={`${id}-branch`}>
          <Select id={`${id}-branch`} value={form.branch} onChange={form.setBranch} options={textOptions(BRANCH_OPTIONS)} />
        </LabeledControl>
        <LabeledControl label="日期" htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            type="date"
            className={cn(fieldControlClass(), "h-12")}
            value={form.date}
            onChange={(e) => form.setDate(e.target.value)}
          />
        </LabeledControl>
      </div>

      <LabeledControl
        label={form.direction === "income" ? "錢收到誰手上？" : "錢從誰手上付的？"}
        htmlFor={`${id}-holder`}
      >
        <Select id={`${id}-holder`} value={form.holder} onChange={form.setHolder} options={textOptions(FUND_HOLDERS)} />
      </LabeledControl>

      <LabeledControl label={<>關聯<span className="ml-1 font-normal text-neutral-500">（選填）</span></>} htmlFor={`${id}-session`}>
        <Select
          id={`${id}-session`}
          value={form.sessionId}
          onChange={form.setSessionId}
          options={[
            { value: "", label: "無" },
            ...monthSessions.map((s) => ({ value: s.id, label: `課程場次：${s.title} ${s.date}` })),
          ]}
        />
      </LabeledControl>

      <LabeledControl label="說明" htmlFor={`${id}-note`}>
        <input
          id={`${id}-note`}
          className={cn(fieldControlClass(), "h-12")}
          placeholder="例：萬聖節舞會 酒水"
          value={form.note}
          onChange={(e) => form.setNote(e.target.value)}
        />
      </LabeledControl>

      <LaterAction className="[&>button]:flex-1 w-full">
        <Camera className="size-4" />
        拍收據／上傳附件
      </LaterAction>
    </div>
  );
}

/** 「記一筆」按下去才打開（桌面置中彈窗、手機底部抽屜）。 */
export function EntryFormDrawer({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (entry: NewEntry) => void;
}) {
  const form = useEntryForm(onSave);
  const save = () => {
    if (form.submit()) onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      onSubmit={save}
      title="記一筆"
      subtitle={`記錄人：${currentUser}。送出的時間會自動記下，之後的修改也都留紀錄。`}
      secondaryText="取消"
      submitText="儲存"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="pb-4"
      >
        <EntryFields form={form} />
      </form>
    </Drawer>
  );
}
