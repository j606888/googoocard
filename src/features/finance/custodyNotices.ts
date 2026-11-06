import type { Buckets } from "@/domains/finance/ledger";
import { formatMoney } from "@/lib/money";
import type { CustodyWarning } from "@/service/finance/custody";

/** spec §14.6：公積金為負、而且手上的錢比預收少 → 等於動用了學生的預付款。 */
export function fundDeficits(b: Buckets, locationNames: Record<number, string>): string[] {
  if (!(b.cash < b.prepaid)) return [];
  return Object.keys(b.funds)
    .map(Number)
    .sort((x, y) => x - y)
    .filter((id) => Math.round(b.funds[id]) < 0)
    .map((id) => `${locationNames[id] ?? "分部"}公積金 −$${formatMoney(Math.abs(b.funds[id]))}，等於先用了學生預付的錢`);
}

/** 最早沒鎖的月份早於本月 → 「{月}還沒結算」；否則 null。月份是 YYYY-MM。 */
export function unsettledNotice(openMonth: string | undefined, currentMonth: string): string | null {
  return openMonth && openMonth < currentMonth ? `${Number(openMonth.slice(5))} 月還沒結算` : null;
}

export function warningsNotice(warnings: CustodyWarning[]): string | null {
  return warnings.length > 0 ? "有些錢找不到該給誰，請檢查老師付款人／分部負責人設定" : null;
}
