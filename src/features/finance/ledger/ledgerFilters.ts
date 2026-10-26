import type { Transaction } from "../types";

export const ALL = "all";

export type LedgerFilters = {
  category: string;
  branch: string;
  holder: string;
  query: string;
};

export const EMPTY_FILTERS: LedgerFilters = { category: ALL, branch: ALL, holder: ALL, query: "" };

export function isFiltered(filters: LedgerFilters): boolean {
  return (
    filters.category !== ALL || filters.branch !== ALL || filters.holder !== ALL || filters.query.trim() !== ""
  );
}

export function filterTransactions(rows: Transaction[], filters: LedgerFilters): Transaction[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter(
    (tx) =>
      (filters.category === ALL || tx.category === filters.category) &&
      (filters.branch === ALL || tx.branch === filters.branch) &&
      (filters.holder === ALL || tx.holder === filters.holder) &&
      (query === "" || tx.description.toLowerCase().includes(query))
  );
}

/** 篩選結果的收入／支出小計；被沖銷的原交易和沖銷交易互相抵消，不計入。 */
export function ledgerSubtotals(rows: Transaction[]): { income: number; expense: number } {
  const counted = rows.filter((tx) => !tx.reversedBy && !tx.reverses);
  return {
    income: counted.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
    expense: counted.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0),
  };
}
