"use client";

import { useState } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import FinancePageHeader from "../FinancePageHeader";
import { stampNow, transactions, transfers } from "../mockData";
import type { Transaction, Transfer } from "../types";
import { LaterAction, Panel } from "../ui";
import { EntryFormDrawer, type NewEntry } from "./EntryForm";
import LedgerDetail from "./LedgerDetail";
import { EMPTY_FILTERS, filterItems, isFiltered, itemKey, ledgerItems, ledgerTotals, type LedgerFilters } from "./ledgerFilters";
import { isArchived } from "./ledgerHistory";
import LedgerList, { LedgerSummary, LedgerToolbar } from "./LedgerList";
import { TransferFormDrawer, type NewTransfer } from "./TransferForm";

/**
 * 流水帳：依日期分組的每一筆收支與轉移。「記一筆」「轉移」按下去才打開表單；
 * 點一列看誰記的、改過什麼，並在那裡編輯、封存、還原。
 * 示意：改動只留在畫面上，重新整理就回到示意資料。
 */
export default function Ledger() {
  const canEdit = useCan("finance.edit");
  const [entries, setEntries] = useState<Transaction[]>(transactions);
  const [moves, setMoves] = useState<Transfer[]>(transfers);
  const [filters, setFilters] = useState<LedgerFilters>(EMPTY_FILTERS);
  const [form, setForm] = useState<"entry" | "transfer" | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const all = ledgerItems(entries, moves);
  const visible = filterItems(all, filters);
  const selected = all.find((item) => itemKey(item) === selectedKey) ?? null;
  const filtered = isFiltered(filters);

  const addEntry = (entry: NewEntry) => {
    const created = { type: "created" as const, ...stampNow() };
    setEntries((current) => [
      { ...entry, id: Math.max(0, ...current.map((tx) => tx.id)) + 1, history: [created] },
      ...current,
    ]);
  };
  const addTransfer = (transfer: NewTransfer) =>
    setMoves((current) => [
      { ...transfer, id: `T-${Math.max(1000, ...current.map((t) => Number(t.id.slice(2)))) + 1}` },
      ...current,
    ]);
  const changeEntry = (tx: Transaction) => setEntries((current) => current.map((t) => (t.id === tx.id ? tx : t)));
  const changeTransfer = (transfer: Transfer) =>
    setMoves((current) => current.map((t) => (t.id === transfer.id ? transfer : t)));

  return (
    <div className="flex flex-col gap-5">
      <FinancePageHeader
        title="流水帳"
        description="每一筆錢的進出。可以編輯和封存，每次改動都留下紀錄。"
        actions={
          <>
            <LaterAction size="sm">匯出 CSV</LaterAction>
            {canEdit && (
              <>
                <Button variant="secondary" onClick={() => setForm("transfer")}>
                  <ArrowLeftRight className="size-4" />
                  轉移
                </Button>
                <Button onClick={() => setForm("entry")}>
                  <Plus className="size-4" />
                  記一筆
                </Button>
              </>
            )}
          </>
        }
      />

      <LedgerToolbar
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        archivedCount={entries.filter(isArchived).length}
      />
      <LedgerSummary totals={ledgerTotals(visible)} filtered={filtered} />

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            kind="filtered"
            title={filters.query.trim() ? `沒有符合「${filters.query.trim()}」的紀錄` : "沒有符合條件的紀錄"}
            description="換個條件，或清除篩選看全部。"
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  清除篩選
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <LedgerList
          items={visible}
          selectedKey={detailOpen ? selectedKey : null}
          onSelect={(item) => {
            setSelectedKey(itemKey(item));
            setDetailOpen(true);
          }}
        />
      )}

      <LedgerDetail
        open={detailOpen}
        item={selected}
        canEdit={canEdit}
        onClose={() => setDetailOpen(false)}
        onChangeEntry={changeEntry}
        onChangeTransfer={changeTransfer}
      />
      {canEdit && (
        <>
          <EntryFormDrawer open={form === "entry"} onClose={() => setForm(null)} onSave={addEntry} />
          <TransferFormDrawer open={form === "transfer"} onClose={() => setForm(null)} onSave={addTransfer} />
        </>
      )}
    </div>
  );
}
