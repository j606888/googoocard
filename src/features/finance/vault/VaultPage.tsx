"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { Skeleton } from "@/components/ui/skeleton";
import { ENTRY_CATEGORIES, isEntryCategory } from "@/domains/finance/money";
import {
  useGetEntryHistoryQuery,
  useGetFinanceSettingQuery,
  useGetVaultLedgerQuery,
  useVoidEntryMutation,
  type VaultEntryRow,
  type VaultRow,
} from "@/store/slices/finance";
import { Figure, Panel } from "../ui";
import { dayLabel, money } from "../format";
import ReasonDialog from "../ReasonDialog";
import HistoryDialog from "../HistoryDialog";
import EntryDialog from "./EntryDialog";

/**
 * 大水庫的存摺：期初、營收負責人自己收的課卡、確認過的繳回、手記帳。
 * 大家都看得到；只有營收負責人能記、改、作廢。
 */
export default function VaultPage() {
  const { data, isLoading } = useGetVaultLedgerQuery();
  const { data: state } = useGetFinanceSettingQuery();
  const [voidEntry] = useVoidEntryMutation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<VaultEntryRow | null>(null);
  const [voiding, setVoiding] = useState<VaultEntryRow | null>(null);
  const [historyOf, setHistoryOf] = useState<VaultEntryRow | null>(null);
  const history = useGetEntryHistoryQuery(historyOf?.id ?? 0, { skip: !historyOf });
  const canWrite = Boolean(state?.isRevenueOwner);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Figure big label="大水庫現在有" value={data.vault} hint={`${data.setting.revenueOwner?.name ?? "營收負責人"} 保管 · 現金＋銀行`} />
          {canWrite && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden="true" />
              記一筆
            </Button>
          )}
        </div>
        {data.ownerLoan !== null && (
          <div className="border-t border-neutral-200 pt-4">
            <Figure label="建城貸款（欠老闆的）" value={data.ownerLoan} hint="只記帳、不排還款" />
          </div>
        )}
      </Panel>

      <Panel title="進出明細">
        <ul className="flex flex-col divide-y divide-neutral-200">
          {data.entries.map((row, i) => (
            <Row
              key={`${row.kind}-${"id" in row ? row.id : "studentCardId" in row ? row.studentCardId : i}`}
              row={row}
              canWrite={canWrite}
              onEdit={setEditing}
              onVoid={setVoiding}
              onHistory={setHistoryOf}
            />
          ))}
        </ul>
      </Panel>

      {adding && <EntryDialog open onClose={() => setAdding(false)} members={data.members} />}
      {editing && <EntryDialog open onClose={() => setEditing(null)} members={data.members} editing={editing} />}
      <ReasonDialog
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title="作廢這筆"
        description="不會真的刪掉：作廢後不算進餘額，紀錄大家都看得到。"
        confirmLabel="作廢"
        danger
        onConfirm={async (reason) => {
          await voidEntry({ id: voiding!.id, reason }).unwrap();
          toast.success("作廢了");
        }}
      />
      <HistoryDialog open={historyOf !== null} onClose={() => setHistoryOf(null)} title="修改紀錄" revisions={history.data} members={data.members} />
    </div>
  );
}

function Row({
  row,
  canWrite,
  onEdit,
  onVoid,
  onHistory,
}: {
  row: VaultRow;
  canWrite: boolean;
  onEdit: (r: VaultEntryRow) => void;
  onVoid: (r: VaultEntryRow) => void;
  onHistory: (r: VaultEntryRow) => void;
}) {
  const amount = (n: number, struck = false) => (
    <div className="flex w-28 shrink-0 flex-col items-end">
      <span className={`text-sm font-semibold tabular-nums ${struck ? "text-neutral-400 line-through" : n < 0 ? "text-neutral-900" : "text-primary-900"}`}>
        {money(n, { signed: true })}
      </span>
      <span className="text-xs tabular-nums text-neutral-500">餘 {money(row.balance)}</span>
    </div>
  );
  const line = (title: React.ReactNode, sub: React.ReactNode, n: number, struck = false) => (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-neutral-900">{title}</span>
        <span className="text-[13px] text-neutral-500">{sub}</span>
      </div>
      {amount(n, struck)}
    </div>
  );

  if (row.kind === "opening") return <li className="py-3">{line("期初餘額", `${dayLabel(row.at)} · 建城那天大水庫的錢`, row.amount)}</li>;
  if (row.kind === "card") return <li className="py-3">{line(`課卡 · ${row.studentName}`, `${dayLabel(row.paidAt)} · ${row.cardName} ${row.serial}`, row.amount)}</li>;
  if (row.kind === "remittance") {
    return <li className="py-3">{line(`${row.from.name} 送回主堡`, `${dayLabel(row.sentOn)} · ${row.method === "CASH" ? "現金" : "轉帳"}`, row.amount)}</li>;
  }
  const label = isEntryCategory(row.category) ? ENTRY_CATEGORIES[row.category].label : row.category;
  const payee = row.payee?.name ?? row.payeeName;
  const voided = Boolean(row.voidedAt);
  return (
    <li className="flex flex-col gap-2 py-3">
      {line(
        <span className="flex items-center gap-2">
          {label}
          {payee && <span className="font-normal text-neutral-600">· {payee}</span>}
          {voided && <StatusTag tone="neutral">已作廢</StatusTag>}
        </span>,
        <>
          {dayLabel(row.date)}
          {row.description && ` · ${row.description}`}
          {row.revisionCount > 0 && (
            <button type="button" className="ml-1 font-semibold text-primary-700 underline-offset-2 hover:underline" onClick={() => onHistory(row)}>
              改過 {row.revisionCount} 次
            </button>
          )}
        </>,
        row.signed,
        voided
      )}
      {canWrite && !voided && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(row)}>
            修改
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onVoid(row)}>
            作廢
          </Button>
        </div>
      )}
    </li>
  );
}
