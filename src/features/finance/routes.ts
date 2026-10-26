/**
 * 水庫的網址只在這裡組（docs/modules-plan.md §3.2）。元件與假資料只講「哪一頁」，
 * 不寫死 `/finance/...`。
 */

const BASE = "/finance";

/** 不需要參數的頁面。 */
export type FinancePage = "dashboard" | "ledger" | "funds" | "fundSettings" | "sessions" | "rules" | "close";
/** 某個小水庫底下的頁面。 */
export type PoolPage = "pool" | "remit";

const PATHS: Record<FinancePage, string> = {
  dashboard: BASE,
  ledger: `${BASE}/ledger`,
  funds: `${BASE}/funds`,
  fundSettings: `${BASE}/funds/settings`,
  sessions: `${BASE}/sessions`,
  rules: `${BASE}/rules`,
  close: `${BASE}/close`,
};

export function financeHref(page: FinancePage): string;
export function financeHref(page: PoolPage, poolId: string): string;
export function financeHref(page: FinancePage | PoolPage, poolId?: string): string {
  if (page === "pool" || page === "remit") {
    const pool = `${BASE}/funds/${encodeURIComponent(poolId ?? "")}`;
    return page === "remit" ? `${pool}/remit` : pool;
  }
  return PATHS[page];
}
