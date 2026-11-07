// 分錄行的純函式：分部自平衡、比對差額、鎖帳日落點（docs/finance-v2/03-architecture.md §3）。
import { accountRefKey, type AccountRef } from "./accounts";

export type Party = { type: "STUDENT_CARD" | "DROP_IN" | "TEACHER" | "VENUE" | "USER" | "STUDENT" | "LOCATION"; id: number };

/** 過帳器算出的「應有」分錄行。amount 單位分；正＝借、負＝貸。date 為台北日期 YYYY-MM-DD。 */
export type DesiredLine = {
  date: string;
  account: AccountRef;
  locationId: number;
  amount: number;
  party?: Party;
  lessonPeriodId?: number;
  memo?: string;
};

/** 聚合用的鍵：同一個鍵的行可以相加（memo 不算鍵）。 */
export function lineKey(l: Omit<DesiredLine, "amount" | "memo">): string {
  return [
    l.date,
    accountRefKey(l.account),
    l.locationId,
    l.party ? `${l.party.type}:${l.party.id}` : "",
    l.lessonPeriodId ?? "",
  ].join("|");
}

/** 同鍵相加、去掉 0。結果依鍵排序，讓雜湊穩定。 */
export function aggregateLines(lines: DesiredLine[]): DesiredLine[] {
  const map = new Map<string, DesiredLine>();
  for (const l of lines) {
    assertIntegerCents(l.amount);
    const k = lineKey(l);
    const cur = map.get(k);
    if (cur) cur.amount += l.amount;
    else map.set(k, { ...l });
  }
  return [...map.entries()]
    .filter(([, l]) => l.amount !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, l]) => l);
}

/** desired − posted，逐鍵相減；結果就是要新記的那筆分錄。冪等：desired = posted 時回傳 []。 */
export function diffLines(desired: DesiredLine[], posted: DesiredLine[]): DesiredLine[] {
  return aggregateLines([...desired, ...posted.map((l) => ({ ...l, amount: -l.amount }))]);
}

/**
 * 讓每個（日期 × 分部）借貸平衡：不平的部分補「分部往來」行。
 * 前提：同一天全部分部加起來是平的（一般分錄本來就該如此），否則丟錯。
 * 往來行帶 party = 對方分部，兩個以上分部時以貪婪法配對（欠最多的先對最多的）。
 */
export function balanceByBranch(lines: DesiredLine[]): DesiredLine[] {
  const out = [...lines];
  const byDate = new Map<string, Map<number, number>>();
  for (const l of lines) {
    const m = byDate.get(l.date) ?? new Map<number, number>();
    m.set(l.locationId, (m.get(l.locationId) ?? 0) + l.amount);
    byDate.set(l.date, m);
  }
  for (const [date, m] of byDate) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    if (total !== 0) throw new Error(`balanceByBranch: entry on ${date} is unbalanced by ${total}`);
    // 借多（>0）的分部要補貸方往來；貸多（<0）的要補借方往來。
    const debit = [...m.entries()].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
    const credit = [...m.entries()].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
    debit.sort((a, b) => b.v - a.v || a.id - b.id);
    credit.sort((a, b) => b.v - a.v || a.id - b.id);
    let i = 0;
    let j = 0;
    while (i < debit.length && j < credit.length) {
      const amt = Math.min(debit[i].v, credit[j].v);
      // debit[i] 分部收到了價值（借多）→ 它欠 credit[j]：貸「分部往來（對方 credit[j]）」。
      out.push({ date, account: { key: "INTERBRANCH" }, locationId: debit[i].id, amount: -amt, party: { type: "LOCATION", id: credit[j].id } });
      out.push({ date, account: { key: "INTERBRANCH" }, locationId: credit[j].id, amount: amt, party: { type: "LOCATION", id: debit[i].id } });
      debit[i].v -= amt;
      credit[j].v -= amt;
      if (debit[i].v === 0) i++;
      if (credit[j].v === 0) j++;
    }
  }
  return out;
}

/** 檢查：每個（日期 × 分部）Σ = 0。回傳不平的清單（空陣列＝平衡）。 */
export function unbalanced(lines: DesiredLine[]): { date: string; locationId: number; amount: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) {
    const k = `${l.date}|${l.locationId}`;
    m.set(k, (m.get(k) ?? 0) + l.amount);
  }
  return [...m.entries()]
    .filter(([, v]) => v !== 0)
    .map(([k, amount]) => {
      const [date, loc] = k.split("|");
      return { date, locationId: Number(loc), amount };
    });
}

/** 加一天（台北日期字串）。 */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 鎖帳日落點：日期 ≤ lockDate 的行移到 lockDate 的隔天（03 §3.3）。lockDate 為 null＝沒鎖。
 * 移動整天的行，所以原本每天平衡的分錄移完後仍然平衡（同一天的行一起移）。
 */
export function applyLockDate(lines: DesiredLine[], lockDate: string | null): DesiredLine[] {
  if (!lockDate) return lines;
  const firstOpen = addDays(lockDate, 1);
  return lines.map((l) => (l.date <= lockDate ? { ...l, date: firstOpen } : l));
}

/** 依日期分組，每組一筆分錄。 */
export function groupByDate(lines: DesiredLine[]): Map<string, DesiredLine[]> {
  const m = new Map<string, DesiredLine[]>();
  for (const l of lines) {
    const arr = m.get(l.date) ?? [];
    arr.push(l);
    m.set(l.date, arr);
  }
  return new Map([...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** 穩定雜湊（FNV-1a 32-bit hex）：判斷一個來源的應有分錄有沒有變。 */
export function hashLines(lines: DesiredLine[]): string {
  const s = aggregateLines(lines)
    .map((l) => `${lineKey(l)}=${l.amount}`)
    .join(";");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function assertIntegerCents(n: number) {
  if (!Number.isInteger(n)) throw new Error(`ledger amounts must be integer cents, got ${n}`);
}
