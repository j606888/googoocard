"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { monthOf } from "@/domains/finance/months";
import { formatMoney } from "@/lib/money";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import {
  useDeleteExpenseMutation,
  useDeletePackMutation,
  useDeleteTransferMutation,
  useGetFinanceExpensesQuery,
  useGetFinancePacksQuery,
  useGetFinanceSettingsQuery,
  useGetFinanceTransfersQuery,
  useGetFinanceVenuesQuery,
  type FinanceTransfer,
} from "@/store/slices/finance";
import ExpenseForm from "./ExpenseForm";
import PackForm from "./PackForm";
import TransferForm from "./TransferForm";
import MonthSwitcher from "./MonthSwitcher";
import { financeErrorText } from "./financeUi";
import { useSplitNames } from "./useSplitNames";

type Voiding = { kind: "expense" | "pack" | "transfer"; id: number; text: string } | null;

const ymd = (iso: string) => toTaipeiDateKey(new Date(iso)).slice(5).replace("-", "/");

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Row({
  title,
  meta,
  amount,
  onVoid,
}: {
  title: string;
  meta?: string;
  amount: number;
  onVoid?: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-neutral-900">{title}</span>
        {meta && <span className="truncate text-[13px] text-neutral-500">{meta}</span>}
      </div>
      <span className="shrink-0 font-medium tabular-nums text-neutral-900">${formatMoney(amount)}</span>
      {onVoid && (
        <button
          type="button"
          aria-label={`作廢 ${title}`}
          onClick={onVoid}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-neutral-500 cursor-pointer hover:bg-neutral-100"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

/** 支出、場地次數包、轉帳：一個月一頁。財務才能新增與作廢，其他人唯讀。 */
export default function CashView() {
  const [month, setMonth] = useState(monthOf(new Date()));
  const names = useSplitNames();
  const { data: settings, isLoading: settingsLoading } = useGetFinanceSettingsQuery();
  const { data: expenseData, isLoading } = useGetFinanceExpensesQuery(month, { skip: !settings?.enabled });
  const { data: packData } = useGetFinancePacksQuery(undefined, { skip: !settings?.enabled });
  const { data: venueData } = useGetFinanceVenuesQuery(undefined, { skip: !settings?.enabled });
  const { data: transferData } = useGetFinanceTransfersQuery(undefined, { skip: !settings?.enabled });
  const [delExpense, { isLoading: d1 }] = useDeleteExpenseMutation();
  const [delPack, { isLoading: d2 }] = useDeletePackMutation();
  const [delTransfer, { isLoading: d3 }] = useDeleteTransferMutation();
  const [form, setForm] = useState<"expense" | "pack" | "transfer" | null>(null);
  const [voiding, setVoiding] = useState<Voiding>(null);

  if (settingsLoading || (settings?.enabled && isLoading)) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (!settings?.enabled) return <EmptyState kind="page" title="這間教室還沒開財務" />;

  const members = settings.members;
  const userName = (id: number) => members.find((m) => m.userId === id)?.name ?? "成員";
  const canEdit = names.canEdit;
  const addButton = (kind: "expense" | "pack" | "transfer", label: string) =>
    canEdit ? (
      <Button size="sm" variant="secondary" onClick={() => setForm(kind)}>
        {label}
      </Button>
    ) : undefined;

  const expenses = expenseData?.expenses ?? [];
  const packs = (packData?.packs ?? []).filter((p) => !p.voidedAt && monthOf(new Date(p.purchasedAt)) === month);
  const transfers = (transferData?.transfers ?? []).filter((t) => monthOf(new Date(t.date)) === month);

  const venueName = (id: number) => (venueData?.venues ?? []).find((v) => v.id === id)?.name ?? "場地";
  const targetName = (t: FinanceTransfer) =>
    t.toKind === "SELF"
      ? "自己領走"
      : t.toKind === "USER"
        ? userName(t.toUserId ?? 0)
        : t.toKind === "TEACHER"
          ? names.teacher(t.toTeacherId ?? 0)
          : venueName(t.toVenueId ?? 0);

  const confirmVoid = async () => {
    if (!voiding) return;
    try {
      if (voiding.kind === "expense") await delExpense(voiding.id).unwrap();
      else if (voiding.kind === "pack") await delPack(voiding.id).unwrap();
      else await delTransfer(voiding.id).unwrap();
      toast.success("已作廢");
    } catch (e) {
      toast.error(financeErrorText(e, "作廢失敗，請再試一次"));
    }
    setVoiding(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <MonthSwitcher month={month} onChange={setMonth} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="支出" action={addButton("expense", "記支出")}>
          {expenses.length === 0 ? (
            <EmptyState kind="inline" title="這個月沒有支出" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {expenses.map((e) => (
                <Row
                  key={e.id}
                  title={`${e.category}・${names.location(e.locationId)}`}
                  meta={`${ymd(e.date)}　${userName(e.paidByUserId)}付${e.note ? `　${e.note}` : ""}`}
                  amount={e.amount}
                  onVoid={canEdit ? () => setVoiding({ kind: "expense", id: e.id, text: `${e.category} $${formatMoney(e.amount)}` }) : undefined}
                />
              ))}
            </ul>
          )}
        </Section>
        <Section title="場地次數包" action={addButton("pack", "買次數包")}>
          {packs.length === 0 ? (
            <EmptyState kind="inline" title="這個月沒有買次數包" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {packs.map((p) => (
                <Row
                  key={p.id}
                  title={`${venueName(p.venueId)} ${p.sessions} 次`}
                  meta={`${ymd(p.purchasedAt)}　${userName(p.paidByUserId)}付`}
                  amount={p.price}
                  onVoid={canEdit ? () => setVoiding({ kind: "pack", id: p.id, text: `${venueName(p.venueId)} ${p.sessions} 次包` }) : undefined}
                />
              ))}
            </ul>
          )}
        </Section>
        <Section title="轉帳" action={addButton("transfer", "記轉帳")}>
          {transfers.length === 0 ? (
            <EmptyState kind="inline" title="這個月沒有轉帳" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {transfers.map((t) => (
                <Row
                  key={t.id}
                  title={`${userName(t.fromUserId)} → ${targetName(t)}`}
                  meta={`${ymd(t.date)}${t.settlementMonth ? `　${t.settlementMonth} 月結` : ""}${t.note ? `　${t.note}` : ""}`}
                  amount={t.amount}
                  onVoid={canEdit ? () => setVoiding({ kind: "transfer", id: t.id, text: `${userName(t.fromUserId)} → ${targetName(t)} $${formatMoney(t.amount)}` }) : undefined}
                />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <ExpenseForm open={form === "expense"} onClose={() => setForm(null)} />
      <PackForm open={form === "pack"} onClose={() => setForm(null)} />
      <TransferForm open={form === "transfer"} onClose={() => setForm(null)} />
      <ConfirmDialog
        variant="danger"
        open={!!voiding}
        title="作廢這一筆"
        message={`確定要作廢「${voiding?.text ?? ""}」嗎？作廢後保管中會重新計算。`}
        confirmLabel="作廢"
        isLoading={d1 || d2 || d3}
        onConfirm={confirmVoid}
        onCancel={() => setVoiding(null)}
      />
    </div>
  );
}
