"use client";

import { useId, useState, type FormEvent } from "react";
import { Camera, Plus } from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import FilterChip from "@/components/FilterChip";
import SegmentedTabs from "@/components/SegmentedTabs";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BRANCHES,
  BRANCH_OPTIONS,
  DEFAULT_HOLDER,
  EXPENSE_CATEGORIES,
  FUND_HOLDERS,
  INCOME_CATEGORIES,
  monthSessions,
  period,
} from "../mockData";
import type { Direction, Transaction } from "../types";
import { LaterAction, LabeledControl, Panel } from "../ui";

export type TransactionDraft = Omit<Transaction, "id">;

const categoriesFor = (direction: Direction) => (direction === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

/** 「2026-10-24」→「10/24」 */
const toShortDate = (iso: string) => iso.slice(5).replace("-", "/");

/** 記一筆的狀態與送出；桌面的側欄卡片和手機的抽屜共用。 */
function useEntryForm(onSave: (draft: TransactionDraft) => void) {
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
      date: toShortDate(date),
      category,
      description: note.trim() || (session ? `${session.title} · ${session.date}` : category),
      branch,
      holder,
      amount: direction === "income" ? amount : -amount,
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
  const select = cn(fieldControlClass(), "h-12");

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
          <select id={`${id}-branch`} className={select} value={form.branch} onChange={(e) => form.setBranch(e.target.value)}>
            {BRANCH_OPTIONS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </LabeledControl>
        <LabeledControl label="日期" htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            type="date"
            className={select}
            value={form.date}
            onChange={(e) => form.setDate(e.target.value)}
          />
        </LabeledControl>
      </div>

      <LabeledControl label="錢現在在誰手上？" htmlFor={`${id}-holder`}>
        <select id={`${id}-holder`} className={select} value={form.holder} onChange={(e) => form.setHolder(e.target.value)}>
          {FUND_HOLDERS.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </LabeledControl>

      <LabeledControl label={<>關聯<span className="ml-1 font-normal text-neutral-500">（選填）</span></>} htmlFor={`${id}-session`}>
        <select
          id={`${id}-session`}
          className={select}
          value={form.sessionId}
          onChange={(e) => form.setSessionId(e.target.value)}
        >
          <option value="">無</option>
          {monthSessions.map((s) => (
            <option key={s.id} value={s.id}>
              課程場次：{s.title} {s.date}
            </option>
          ))}
        </select>
      </LabeledControl>

      <LabeledControl label="備註" htmlFor={`${id}-note`}>
        <input
          id={`${id}-note`}
          className={cn(fieldControlClass(), "h-12")}
          placeholder="例：體驗課 8 人"
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

const RULE_HINT = "儲存後無法修改；打錯了請用「沖銷」再記一筆正確的。";

/** 桌面：流水帳右邊的「記一筆」卡片。 */
export function EntryFormPanel({ onSave }: { onSave: (draft: TransactionDraft) => void }) {
  const form = useEntryForm(onSave);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    form.submit();
  };

  return (
    <Panel aria-label="記一筆" className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-neutral-900">記一筆</h3>
        <EntryFields form={form} />
        <Button type="submit" size="lg">
          儲存這一筆
        </Button>
        <p className="text-[13px] leading-relaxed text-neutral-500">{RULE_HINT}</p>
      </form>
    </Panel>
  );
}

/** 手機：「記一筆」打開的抽屜。 */
export function EntryFormDrawer({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: TransactionDraft) => void;
}) {
  const form = useEntryForm(onSave);
  const save = () => {
    if (form.submit()) onClose();
  };

  return (
    <Drawer open={open} onClose={onClose} onSubmit={save} title="記一筆" subtitle={RULE_HINT} submitText="儲存這一筆">
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
