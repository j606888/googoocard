import { toTaipeiMonthKey } from "@/lib/taipei-date";
import type { IncomeSource } from "./income";
import type { LedgerInput } from "./ledger";
import type { Allocation, Payee } from "./types";
import type { ExpiryTarget } from "@/service/finance/expiry";

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

/** 一張卡的過期收入在某個時點的狀態。快照存這個，鎖住的月份才不會跟著卡的現況變。 */
export type ExpiryState = { value: number; holderUserId: number | null; to: ExpiryTarget };

/** 快照裡的一筆過期收入：卡 id ＋ 鎖住當時的狀態。 */
export type SnapshotExpiry = { id: number } & ExpiryState;

const targetKey = (t: ExpiryTarget) => (t.type === "fund" ? `fund:${t.locationId}` : `user:${t.userId}`);

export function expiryStateEquals(a: ExpiryState, b: ExpiryState): boolean {
  if (Math.abs(a.value) < EPSILON && Math.abs(b.value) < EPSILON) return true;
  return Math.abs(a.value - b.value) < EPSILON && a.holderUserId === b.holderUserId && targetKey(a.to) === targetKey(b.to);
}

/** 過期收入現況 − 基準，依對象相減，只回非零。給結算單的調整列。 */
export function expiryDeltas(live: ExpiryState, baseline: ExpiryState): { to: ExpiryTarget; amount: number }[] {
  const byKey = new Map<string, { to: ExpiryTarget; amount: number }>();
  const add = (s: ExpiryState, sign: 1 | -1) => {
    const key = targetKey(s.to);
    const cur = byKey.get(key);
    if (cur) cur.amount += sign * s.value;
    else byKey.set(key, { to: s.to, amount: sign * s.value });
  };
  add(live, 1);
  add(baseline, -1);
  return [...byKey.values()].filter((d) => Math.abs(d.amount) >= EPSILON);
}

/**
 * 一張卡過期收入的版本鏈（各快照裡的狀態、最後是現況）→ computeCustody 的過期條目，
 * 跟 periodHistoryEntries 同一套：第一版照原樣；之後有變，在新版本的月份放「沖銷上一版」＋「新版」。
 */
export function expiryHistoryEntries(
  studentCardId: number,
  versions: { month: string; state: ExpiryState }[],
): LedgerInput["expiries"] {
  const out: LedgerInput["expiries"] = [];
  let prev: ExpiryState | null = null;
  for (const { month, state } of versions) {
    if (prev ? expiryStateEquals(state, prev) : Math.abs(state.value) < EPSILON) continue;
    if (prev && Math.abs(prev.value) >= EPSILON) out.push({ studentCardId, month, ...prev, value: -prev.value });
    if (Math.abs(state.value) >= EPSILON) out.push({ studentCardId, month, ...state });
    prev = state;
  }
  return out;
}

/** 快照的過期收入：舊格式（只有 id）沒有價值 → null，呼叫端照現況算。 */
export function snapshotExpiries(snapshot: SnapshotCore): { id: number; state: ExpiryState | null }[] {
  return snapshot.eventIds.expiries.map((e) =>
    typeof e === "number" ? { id: e, state: null } : { id: e.id, state: { value: e.value, holderUserId: e.holderUserId, to: e.to } },
  );
}

/** 快照裡某類事件的 id。 */
export function snapshotEventIds(snapshot: SnapshotCore, kind: keyof SnapshotCore["eventIds"]): number[] {
  return kind === "expiries" ? snapshotExpiries(snapshot).map((e) => e.id) : snapshot.eventIds[kind];
}

/**
 * 月結快照裡給帳本用的部分（結算單另外存在 statement）：鎖住時每堂的分帳與已實現收入來源、
 * 這次算進的事件 id、發錢的取整零頭。某堂的基準 = 最新一份包含它的快照。
 */
export type SnapshotCore = {
  periods: Record<string, Allocation[] | null>;
  income: Record<string, IncomeSource[]>;
  /** 每堂的課名與開始時間（ISO），時段之後被刪掉時調整行還能顯示 */
  labels: Record<string, { lessonName: string; startTime: string }>;
  /**
   * 這次算進的事件 id。過期收入連同鎖住當時的價值／保管人／對象一起存（卡的剩格之後還可能變，
   * 例如取消點名退格到已過期的卡）；之後的差額跟時段一樣算進最早沒鎖的月份，並在那次鎖定時重存。
   * 舊格式只有 id（number）。
   */
  eventIds: { expiries: (SnapshotExpiry | number)[]; expenses: number[]; refunds: number[]; transfers: number[] };
  roundings: LedgerInput["roundings"];
};
