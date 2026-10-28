"use client";

import { ArrowLeftRight, ArrowRight, Search } from "lucide-react";
import DataView, { type DataViewColumn } from "@/components/DataView";
import Select, { textOptions, type SelectOption } from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import Money, { EXPENSE_TEXT, INCOME_TEXT } from "../Money";
import { BRANCH_OPTIONS, FUND_HOLDERS, LEDGER_CATEGORIES, period, shortDateLabel } from "../mockData";
import type { Transaction, Transfer } from "../types";
import { categoryTone, transferStatus } from "./ledgerDisplay";
import {
  ALL,
  TRANSFER_CATEGORY,
  groupByDate,
  itemKey,
  type LedgerFilters,
  type LedgerItem,
  type LedgerTotals,
} from "./ledgerFilters";
import { archivedEvent, editCount, recordedOf, stampTime } from "./ledgerHistory";

// ── 篩選列 ──

export function LedgerToolbar({
  filters,
  onChange,
  archivedCount,
}: {
  filters: LedgerFilters;
  onChange: (patch: Partial<LedgerFilters>) => void;
  archivedCount: number;
}) {
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-[1_1_100%] sm:flex-[1_1_240px]">
        <span className="sr-only">搜尋</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="搜尋說明、記錄人…"
          className={cn(fieldControlClass(), "h-11 pl-10 text-[15px]")}
        />
      </label>
      <Select
        aria-label="類別"
        size="sm"
        className="w-auto max-w-full"
        value={filters.category}
        onChange={(category) => onChange({ category })}
        options={withAll("全部類別", [...LEDGER_CATEGORIES, TRANSFER_CATEGORY])}
      />
      <Select
        aria-label="據點"
        size="sm"
        className="w-auto max-w-full"
        value={filters.branch}
        onChange={(branch) => onChange({ branch })}
        options={withAll("全部據點", BRANCH_OPTIONS)}
      />
      <Select
        aria-label="錢在誰手上"
        size="sm"
        className="w-auto max-w-full"
        value={filters.holder}
        onChange={(holder) => onChange({ holder })}
        options={withAll("全部經手人", FUND_HOLDERS)}
      />
      {archivedCount > 0 && (
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 px-1 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(e) => onChange({ showArchived: e.target.checked })}
            className="size-[18px] accent-primary-900"
          />
          顯示封存的 {archivedCount} 筆
        </label>
      )}
    </form>
  );
}

const withAll = (allLabel: string, values: readonly string[]): SelectOption<string>[] => [
  { value: ALL, label: allLabel },
  ...textOptions(values),
];

// ── 這個月（或篩選結果）的收支 ──

export function LedgerSummary({ totals, filtered }: { totals: LedgerTotals; filtered: boolean }) {
  const net = totals.income + totals.expense;
  return (
    <section aria-label={filtered ? "篩選結果的收支" : `${period.monthLabel}的收支`} className="flex flex-col gap-2">
      <p className="px-1 text-[13px] font-medium text-neutral-500">{filtered ? "篩選結果" : period.monthLabel}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="收入" note={`${totals.incomeCount} 筆`} className="bg-primary-50" labelClass={INCOME_TEXT}>
          <Money value={totals.income} sign colored />
        </Tile>
        <Tile label="支出" note={`${totals.expenseCount} 筆`} className="bg-warning-100" labelClass={EXPENSE_TEXT}>
          <Money value={totals.expense} sign colored />
        </Tile>
        <Tile label="淨額" note="不含封存的紀錄" className="border border-neutral-200">
          <Money value={net} sign />
        </Tile>
        <Tile label="轉移" note={`${totals.transferCount} 筆 · 不算收支`} className="border border-neutral-200">
          <Money value={totals.transferAmount} className="text-neutral-700" />
        </Tile>
      </div>
    </section>
  );
}

function Tile({
  label,
  note,
  className,
  labelClass = "text-neutral-600",
  children,
}: {
  label: string;
  note: string;
  className?: string;
  labelClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-2xl px-4 py-3 lg:px-5 lg:py-4", className)}>
      <span className={cn("text-[13px]", labelClass)}>{label}</span>
      <span className="text-xl font-bold lg:text-2xl">{children}</span>
      <span className="text-xs text-neutral-500">{note}</span>
    </div>
  );
}

// ── 依日期分組的列表 ──

/** 每天一個日期標題，底下是那天的每一筆；表頭只在第一天出現。`selectedKey` 是詳細正打開的那一列。 */
export default function LedgerList({
  items,
  selectedKey,
  onSelect,
}: {
  items: LedgerItem[];
  selectedKey: string | null;
  onSelect: (item: LedgerItem) => void;
}) {
  const columns = ledgerColumns(onSelect);
  return (
    <div className="flex flex-col gap-5">
      {groupByDate(items).map((day, i) => (
        <section key={day.date} aria-labelledby={`ledger-day-${day.date}`} className="flex flex-col gap-2">
          <h3 id={`ledger-day-${day.date}`} className="flex items-center gap-2 px-1 text-[15px] font-bold text-neutral-900">
            {shortDateLabel(day.date)}
            {day.date === period.todayShort && <StatusTag tone="positive">今天</StatusTag>}
          </h3>
          <DataView
            columns={columns}
            rows={day.items}
            rowKey={itemKey}
            hideHeader={i > 0}
            rowClassName={(item) =>
              itemKey(item) === selectedKey
                ? "bg-primary-50"
                : item.kind === "transfer" || archivedEvent(item.entry)
                  ? "bg-neutral-50 hover:bg-neutral-100"
                  : "hover:bg-neutral-100"
            }
          />
        </section>
      ))}
    </div>
  );
}

/** 整列都點得到：主要那格是真的 `<button>`，用 after 撐滿整列（DataView 的建議作法）。 */
const ROW_BUTTON =
  "min-w-0 cursor-pointer truncate rounded text-left text-sm font-medium text-neutral-900 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-primary-300 lg:text-[15px]";

function ledgerColumns(onSelect: (item: LedgerItem) => void): DataViewColumn<LedgerItem>[] {
  return [
    {
      key: "description",
      header: "說明 · 誰記的",
      width: "minmax(0,2.2fr)",
      role: "primary",
      render: (item) =>
        item.kind === "entry" ? (
          <EntryTitle tx={item.entry} onSelect={() => onSelect(item)} />
        ) : (
          <TransferTitle transfer={item.transfer} onSelect={() => onSelect(item)} />
        ),
    },
    {
      key: "category",
      header: "類別",
      width: "112px",
      render: (item) =>
        item.kind === "transfer" ? (
          <StatusTag tone="neutral" className="gap-1">
            <ArrowLeftRight className="size-3" aria-hidden="true" />
            {TRANSFER_CATEGORY}
          </StatusTag>
        ) : archivedEvent(item.entry) ? (
          <StatusTag tone="neutral">已封存</StatusTag>
        ) : (
          <StatusTag tone={categoryTone(item.entry)}>{item.entry.category}</StatusTag>
        ),
    },
    {
      key: "branch",
      header: "據點",
      width: "88px",
      render: (item) =>
        item.kind === "entry" ? item.entry.branch : `${item.transfer.fromBranch}→${item.transfer.toBranch}`,
    },
    {
      key: "holder",
      header: "錢在誰手上",
      width: "minmax(0,1fr)",
      hideOnMobile: (item) => item.kind === "entry",
      render: (item) => {
        if (item.kind === "entry") return <span className="truncate">{item.entry.holder}</span>;
        const status = transferStatus(item.transfer);
        return <StatusTag tone={status.tone}>{status.label}</StatusTag>;
      },
    },
    {
      key: "amount",
      header: "金額",
      width: "104px",
      role: "trailing",
      render: (item) => {
        const className = "ml-auto text-sm font-semibold lg:text-[15px]";
        if (item.kind === "transfer") return <Money value={item.transfer.amount} className={cn(className, "text-neutral-700")} />;
        if (archivedEvent(item.entry))
          return (
            <s className="ml-auto text-neutral-500">
              <Money value={item.entry.amount} sign className="text-sm lg:text-[15px]" />
            </s>
          );
        return <Money value={item.entry.amount} sign colored className={className} />;
      },
    },
  ];
}

function EntryTitle({ tx, onSelect }: { tx: Transaction; onSelect: () => void }) {
  const archived = archivedEvent(tx);
  const recorded = recordedOf(tx);
  const edits = editCount(tx);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button type="button" onClick={onSelect} className={cn(ROW_BUTTON, archived && "text-neutral-500 line-through")}>
        {tx.description}
      </button>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-neutral-500">
        {archived ? (
          <span>
            {archived.by} 封存於 {archived.at} ·「{archived.reason}」
          </span>
        ) : (
          <>
            <span>
              #{tx.id} · {recorded.by} 記於 {stampTime(recorded, tx.date)}
            </span>
            {edits > 0 && <StatusTag tone="neutral">已編輯 {edits} 次</StatusTag>}
            {tx.missingReceipt && <StatusTag tone="warning">缺收據</StatusTag>}
          </>
        )}
      </span>
    </div>
  );
}

function TransferTitle({ transfer, onSelect }: { transfer: Transfer; onSelect: () => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button type="button" onClick={onSelect} className={cn(ROW_BUTTON, "inline-flex items-center gap-1.5")}>
        <span className="truncate">{transfer.from}</span>
        <ArrowRight className="size-4 shrink-0 text-neutral-500" aria-label="交給" />
        <span className="truncate">{transfer.to}</span>
      </button>
      <span className="text-xs text-neutral-500">
        {transfer.sent.by} 送出 {stampTime(transfer.sent, transfer.date)}
        {transfer.note && ` · ${transfer.note}`}
      </span>
    </div>
  );
}
