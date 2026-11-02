import { toTaipeiMonthKey } from "@/lib/taipei-date";
import type { IncomeSource } from "./income";
import type { LedgerInput } from "./ledger";
import type { Allocation, Payee } from "./types";

// 月份歸屬與月結快照（spec §7.2–7.3）。純函式。

const EPSILON = 0.005;

/** 台北月份 YYYY-MM。 */
export function monthOf(date: Date): string {
  return toTaipeiMonthKey(date);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** 上線月份起第一個沒鎖的月份。 */
export function earliestOpenMonth(launchMonth: string, lockedMonths: string[]): string {
  const locked = new Set(lockedMonths);
  let month = launchMonth;
  while (locked.has(month)) month = nextMonth(month);
  return month;
}

/** 事件月份已鎖 → 現在最早沒鎖的月份；否則事件本身的月份。 */
export function assignMonth(eventMonth: string, lockedMonths: Set<string>, openMonth: string): string {
  return lockedMonths.has(eventMonth) ? openMonth : eventMonth;
}

function payeeKey(p: Payee): string {
  if (p.type === "teacher") return `teacher:${p.teacherId}`;
  if (p.type === "fund") return `fund:${p.locationId}`;
  return `venue:${p.venueId}:${p.packId ?? ""}`;
}

function allocationDelta(live: Allocation[], baseline: Allocation[]): Allocation[] {
  const byKey = new Map<string, Allocation>();
  const add = (a: Allocation, sign: 1 | -1) => {
    const key = payeeKey(a.payee);
    const cur = byKey.get(key);
    if (cur) cur.amount += sign * a.amount;
    else byKey.set(key, { payee: a.payee, source: a.source, amount: sign * a.amount });
  };
  for (const a of live) add(a, 1);
  for (const a of baseline) add(a, -1);
  return [...byKey.values()].filter((a) => Math.abs(a.amount) >= EPSILON);
}

/** 每堂現況 − 基準，依 payee 相減，只回非零（|x| ≥ 0.005）。只在一邊的時段當另一邊是空的。 */
export function periodDeltas(
  live: Map<number, Allocation[]>,
  baseline: Map<number, Allocation[]>,
): Map<number, Allocation[]> {
  const out = new Map<number, Allocation[]>();
  for (const periodId of new Set([...live.keys(), ...baseline.keys()])) {
    const d = allocationDelta(live.get(periodId) ?? [], baseline.get(periodId) ?? []);
    if (d.length > 0) out.set(periodId, d);
  }
  return out;
}

/** 一堂課在某個時點的財務：已實現收入來源＋分帳（null = 沒有規則）。快照存的就是這個。 */
export type PeriodState = { income: IncomeSource[]; allocations: Allocation[] | null };

export const EMPTY_PERIOD_STATE: PeriodState = { income: [], allocations: [] };

const sourceKey = (s: IncomeSource) => `${s.kind}:${s.refId}`;

export function periodStateEquals(a: PeriodState, b: PeriodState): boolean {
  if ((a.allocations === null) !== (b.allocations === null)) return false;
  if (allocationDelta(a.allocations ?? [], b.allocations ?? []).length > 0) return false;
  const bySource = new Map(b.income.map((s) => [sourceKey(s), s]));
  if (a.income.length !== b.income.length) return false;
  return a.income.every((s) => {
    const other = bySource.get(sourceKey(s));
    return !!other && other.holderUserId === s.holderUserId && Math.abs(other.amount - s.amount) < EPSILON;
  });
}

/**
 * 一堂課的版本鏈（依序：各快照裡的狀態、最後是現況，各帶它算進的月份）→ computeCustody 的時段條目。
 * 第一個版本照原樣；之後每次有變，在新版本的月份放「沖銷上一版」＋「新版」兩筆：
 * 各自的收入與分帳同號，比例照各自的 holder 算，所以保管中的不變式永遠成立；
 * 收入沒變、只改分帳（例：改規則）時，差額自然照原本 holder 的比例分。
 */
export function periodHistoryEntries(
  periodId: number,
  versions: { month: string; state: PeriodState }[],
): LedgerInput["periods"] {
  const out: LedgerInput["periods"] = [];
  let prev: PeriodState = EMPTY_PERIOD_STATE;
  for (const { month, state } of versions) {
    if (periodStateEquals(state, prev)) continue;
    if (prev.income.length > 0 || (prev.allocations?.length ?? 0) > 0) {
      out.push({
        periodId,
        month,
        income: prev.income.map((s) => ({ ...s, amount: -s.amount })),
        allocations: prev.allocations?.map((a) => ({ ...a, amount: -a.amount })) ?? null,
      });
    }
    out.push({ periodId, month, income: state.income, allocations: state.allocations });
    prev = state;
  }
  return out;
}

/**
 * 月結快照裡給帳本用的部分（結算單另外存在 statement）：鎖住時每堂的分帳與已實現收入來源、
 * 這次算進的事件 id、發錢的取整零頭。某堂的基準 = 最新一份包含它的快照。
 */
export type SnapshotCore = {
  periods: Record<string, Allocation[] | null>;
  income: Record<string, IncomeSource[]>;
  eventIds: { expiries: number[]; expenses: number[]; refunds: number[]; transfers: number[] };
  roundings: LedgerInput["roundings"];
};
