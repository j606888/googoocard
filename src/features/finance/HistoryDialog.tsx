"use client";

import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ENTRY_CATEGORIES, isEntryCategory } from "@/domains/finance/money";
import type { FinanceUser, Revision } from "@/store/slices/finance";
import { dayLabel, money } from "./format";

const FIELD_LABELS: Record<string, string> = {
  date: "日期",
  category: "分類",
  amount: "金額",
  payeeUserId: "付給",
  payeeName: "付給",
  description: "說明",
  revenueOwnerUserId: "營收負責人",
  openingBalance: "期初餘額",
  openingOwnerLoan: "建城貸款",
};

function show(key: string, value: unknown, members: FinanceUser[]): string {
  if (value === null || value === undefined || value === "") return "（空）";
  if (key === "amount" || key === "openingBalance" || key === "openingOwnerLoan") return money(Number(value));
  if (key === "category") return isEntryCategory(String(value)) ? ENTRY_CATEGORIES[String(value) as keyof typeof ENTRY_CATEGORIES].label : String(value);
  if (key === "payeeUserId" || key === "revenueOwnerUserId") return members.find((m) => m.id === value)?.name ?? `#${value}`;
  return String(value);
}

/** 修改紀錄：誰、什麼時候、為什麼、改了哪些欄位。大家都看得到。 */
export default function HistoryDialog({ open, onClose, title, revisions, members }: { open: boolean; onClose: () => void; title: string; revisions?: Revision[]; members: FinanceUser[] }) {
  return (
    <ResponsiveDialog open={open} onClose={onClose} className="gap-4 overflow-y-auto p-5">
      <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">{title}</ResponsiveDialogTitle>
      {!revisions ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : revisions.length === 0 ? (
        <p className="text-sm text-neutral-500">沒有改過</p>
      ) : (
        <ol className="flex flex-col divide-y divide-neutral-200">
          {revisions.map((r) => {
            const keys = r.after ? Object.keys(r.after).filter((k) => JSON.stringify(r.before[k]) !== JSON.stringify(r.after![k])) : [];
            return (
              <li key={r.id} className="flex flex-col gap-1 py-3">
                <span className="text-sm font-semibold text-neutral-900">
                  {r.editedBy.name} · {dayLabel(r.createdAt)} · {r.after ? "修改" : "作廢"}
                </span>
                <span className="text-sm text-neutral-600">原因：{r.reason}</span>
                {keys.map((k) => (
                  <span key={k} className="text-[13px] text-neutral-500">
                    {FIELD_LABELS[k] ?? k}：{show(k, r.before[k], members)} → {show(k, r.after![k], members)}
                  </span>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </ResponsiveDialog>
  );
}
