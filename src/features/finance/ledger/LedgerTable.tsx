"use client";

import { useId, useState } from "react";
import DataView, { type DataViewColumn } from "@/components/DataView";
import EmptyState from "@/components/EmptyState";
import StatusTag, { type StatusTone } from "@/components/StatusTag";
import { fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Money, { EXPENSE_TEXT, INCOME_TEXT } from "../Money";
import { BRANCH_OPTIONS, FUND_HOLDERS, LEDGER_CATEGORIES, PREPAID_CATEGORY, REVERSAL_CATEGORY, period } from "../mockData";
import type { Transaction } from "../types";
import { Panel } from "../ui";
import { ALL, EMPTY_FILTERS, filterTransactions, isFiltered, ledgerSubtotals, type LedgerFilters } from "./ledgerFilters";

function categoryTone(tx: Transaction): StatusTone {
  if (tx.category === REVERSAL_CATEGORY) return "neutral";
  if (tx.category === PREPAID_CATEGORY) return "outline";
  return tx.amount < 0 ? "warning" : "positive";
}

const COLUMNS: DataViewColumn<Transaction>[] = [
  {
    key: "description",
    header: "說明",
    width: "minmax(0,2fr)",
    role: "primary",
    render: (tx) => {
      const struck = Boolean(tx.reversedBy);
      return (
        <span className={cn("block text-sm lg:text-[15px]", struck ? "text-neutral-500" : "text-neutral-900")}>
          {struck ? <s>{tx.description}</s> : tx.description}
          {struck && <> · 已被 #{tx.reversedBy} 沖銷</>}
          {tx.missingReceipt && <span className={EXPENSE_TEXT}> · 缺收據</span>}
        </span>
      );
    },
  },
  { key: "date", header: "日期", width: "64px", render: (tx) => <span className="tabular-nums">{tx.date}</span> },
  {
    key: "category",
    header: "類別",
    width: "112px",
    render: (tx) => <StatusTag tone={categoryTone(tx)}>{tx.category}</StatusTag>,
  },
  { key: "branch", header: "據點", width: "56px", render: (tx) => tx.branch },
  {
    key: "holder",
    header: "經手人／資金位置",
    width: "minmax(0,1fr)",
    render: (tx) => <span className="truncate">{tx.holder}</span>,
  },
  {
    key: "amount",
    header: "金額",
    width: "96px",
    role: "trailing",
    render: (tx) =>
      tx.reversedBy ? (
        <s className="ml-auto text-neutral-500">
          <Money value={tx.amount} sign className="text-sm lg:text-[15px]" />
        </s>
      ) : (
        <Money value={tx.amount} sign colored className="ml-auto text-sm font-semibold lg:text-[15px]" />
      ),
  },
];

/** 流水帳的篩選＋小計＋列表。 */
export default function LedgerTable({ rows }: { rows: Transaction[] }) {
  const [filters, setFilters] = useState<LedgerFilters>(EMPTY_FILTERS);
  const set = (patch: Partial<LedgerFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const filtered = filterTransactions(rows, filters);
  const { income, expense } = ledgerSubtotals(filtered);
  const query = filters.query.trim();

  return (
    <div className="flex flex-col gap-4">
      <Panel aria-label="篩選" className="p-4">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]"
        >
          <FilterSelect label="日期" value="current" onChange={() => {}} options={[["current", period.monthLabel]]} />
          <FilterSelect
            label="類別"
            value={filters.category}
            onChange={(category) => set({ category })}
            options={[[ALL, "全部類別"], ...LEDGER_CATEGORIES.map((c) => [c, c] as [string, string])]}
          />
          <FilterSelect
            label="據點"
            value={filters.branch}
            onChange={(branch) => set({ branch })}
            options={[[ALL, "全部據點"], ...BRANCH_OPTIONS.map((b) => [b, b] as [string, string])]}
          />
          <FilterSelect
            label="經手人／資金位置"
            value={filters.holder}
            onChange={(holder) => set({ holder })}
            options={[[ALL, "全部"], ...FUND_HOLDERS.map((h) => [h, h] as [string, string])]}
          />
          <SearchInput value={filters.query} onChange={(q) => set({ query: q })} />
        </form>
      </Panel>

      <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-neutral-500">
        <span>
          篩選結果 <b className="tabular-nums text-neutral-900">{filtered.length}</b> 筆
        </span>
        <span>
          收入 <Money value={income} sign className={cn("font-bold", INCOME_TEXT)} />
        </span>
        <span>
          支出 <Money value={expense} className={cn("font-bold", EXPENSE_TEXT)} />
          （不含已沖銷）
        </span>
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            kind="filtered"
            title={query ? `沒有符合「${query}」的交易` : "沒有符合條件的交易"}
            description="換個條件，或清除篩選看全部。"
            action={
              isFiltered(filters) ? (
                <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  清除篩選
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <DataView
          columns={COLUMNS}
          rows={filtered}
          rowKey={(tx) => tx.id}
          rowClassName={(tx) => (tx.reversedBy || tx.reverses ? "bg-neutral-50" : undefined)}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-neutral-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldControlClass(), "h-11 px-3 text-[15px]")}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="col-span-2 flex min-w-0 flex-col gap-1 lg:col-span-1">
      <label htmlFor={id} className="text-[13px] font-medium text-neutral-500">
        搜尋
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="備註、學生、課程…"
        className={cn(fieldControlClass(), "h-11 px-3 text-[15px]")}
      />
    </div>
  );
}
