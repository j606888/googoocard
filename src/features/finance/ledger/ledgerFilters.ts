import type { Transaction, Transfer } from "../types";
import { isArchived, recordedOf } from "./ledgerHistory";

/** 流水帳上的一列：一筆收支，或一筆金錢轉移。 */
export type LedgerItem = { kind: "entry"; entry: Transaction } | { kind: "transfer"; transfer: Transfer };

export const ALL = "all";
/** 類別篩選裡的「只看轉移」。 */
export const TRANSFER_CATEGORY = "轉移";

export type LedgerFilters = {
  category: string;
  branch: string;
  holder: string;
  query: string;
  showArchived: boolean;
};

export const EMPTY_FILTERS: LedgerFilters = { category: ALL, branch: ALL, holder: ALL, query: "", showArchived: false };

/** 有沒有用條件把東西篩掉（「顯示封存」是多看，不算）。 */
export function isFiltered(filters: LedgerFilters): boolean {
  return (
    filters.category !== ALL || filters.branch !== ALL || filters.holder !== ALL || filters.query.trim() !== ""
  );
}

export const itemKey = (item: LedgerItem) => (item.kind === "entry" ? `e${item.entry.id}` : item.transfer.id);
const itemDate = (item: LedgerItem) => (item.kind === "entry" ? item.entry.date : item.transfer.date);
const itemStampAt = (item: LedgerItem) =>
  item.kind === "entry" ? recordedOf(item.entry).at : item.transfer.sent.at;

/** 收支和轉移排在一起：日期新到舊，同一天裡後記的在上面。 */
export function ledgerItems(entries: Transaction[], transfers: Transfer[]): LedgerItem[] {
  const items: LedgerItem[] = [
    ...entries.map((entry) => ({ kind: "entry" as const, entry })),
    ...transfers.map((transfer) => ({ kind: "transfer" as const, transfer })),
  ];
  return items.sort(
    (a, b) => itemDate(b).localeCompare(itemDate(a)) || itemStampAt(b).localeCompare(itemStampAt(a))
  );
}

export function filterItems(items: LedgerItem[], filters: LedgerFilters): LedgerItem[] {
  const query = filters.query.trim().toLowerCase();
  const matches = (...texts: (string | undefined)[]) =>
    query === "" || texts.some((text) => text?.toLowerCase().includes(query));

  return items.filter((item) => {
    if (item.kind === "entry") {
      const tx = item.entry;
      return (
        (filters.showArchived || !isArchived(tx)) &&
        (filters.category === ALL || tx.category === filters.category) &&
        (filters.branch === ALL || tx.branch === filters.branch) &&
        (filters.holder === ALL || tx.holder === filters.holder) &&
        matches(tx.description, recordedOf(tx).by)
      );
    }
    const t = item.transfer;
    return (
      (filters.category === ALL || filters.category === TRANSFER_CATEGORY) &&
      (filters.branch === ALL || t.fromBranch === filters.branch || t.toBranch === filters.branch) &&
      (filters.holder === ALL || t.from === filters.holder || t.to === filters.holder) &&
      matches(t.note, t.from, t.to, t.sent.by)
    );
  });
}

export type LedgerDay = { date: string; items: LedgerItem[] };

/** 依日期分組（保留原本的順序）。 */
export function groupByDate(items: LedgerItem[]): LedgerDay[] {
  const days: LedgerDay[] = [];
  for (const item of items) {
    const date = itemDate(item);
    const last = days[days.length - 1];
    if (last?.date === date) last.items.push(item);
    else days.push({ date, items: [item] });
  }
  return days;
}

export type LedgerTotals = {
  income: number;
  /** 負數 */
  expense: number;
  incomeCount: number;
  expenseCount: number;
  transferAmount: number;
  transferCount: number;
};

/** 收入、支出不含封存的；轉移另外算，不算進收支。 */
export function ledgerTotals(items: LedgerItem[]): LedgerTotals {
  const entries = items.flatMap((item) => (item.kind === "entry" && !isArchived(item.entry) ? [item.entry] : []));
  const transfers = items.flatMap((item) => (item.kind === "transfer" ? [item.transfer] : []));
  const incomes = entries.filter((tx) => tx.amount > 0);
  const expenses = entries.filter((tx) => tx.amount < 0);
  const sum = (amounts: number[]) => amounts.reduce((total, amount) => total + amount, 0);
  return {
    income: sum(incomes.map((tx) => tx.amount)),
    expense: sum(expenses.map((tx) => tx.amount)),
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    transferAmount: sum(transfers.map((t) => t.amount)),
    transferCount: transfers.length,
  };
}
