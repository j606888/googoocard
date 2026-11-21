import type { Allocation } from "./types";

/**
 * 一堂課的錢怎麼在分部之間流動（docs/finance-lite.md §4–5）。純函式，前後端共用。
 *
 * 收入依「卡錢屬於哪個分部」分成好幾堆（pile）。每一項分出去的錢都有一個「去處」：
 * - 老師、每次付的場地費 → 當天付錢的分部（他先墊出去，各堆要還他）
 * - 次數包場地費 → 當初買包的分部（已經預付了）
 * - 公積金 → 那個分部
 * - 剩下的（holder）→ 各堆自己，不流動
 * 每一堆照「這堆占收入多少」負擔每一項；同一分部自己欠自己不記。
 */

export type Pile = { locationId: number; income: number };

export type FlowReason = "teacher" | "venue" | "fund";

/** from 欠 to 這麼多錢。 */
export type Flow = { from: number; to: number; amount: number; reason: FlowReason };

export type PeriodFlowsInput = {
  income: number;
  piles: Pile[];
  allocations: Allocation[];
  lessonLocationId: number;
  payerLocationId: number;
  /** 次數包是哪個分部買的；沒有就當作當天付錢的分部。 */
  packLocationId?: (packId: number) => number | null;
};

export const roundCents = (x: number) => Math.round(x * 100) / 100;

/** 每一堆的負擔比例；收入是 0（或沒有任何一堆）時，全部算開課分部的。 */
export function pileWeights(income: number, piles: Pile[], lessonLocationId: number) {
  const nonEmpty = piles.filter((p) => p.income !== 0);
  if (income <= 0 || nonEmpty.length === 0) return [{ locationId: lessonLocationId, weight: 1 }];
  return nonEmpty.map((p) => ({ locationId: p.locationId, weight: p.income / income }));
}

function ownerOf(a: Allocation, input: PeriodFlowsInput): { locationId: number; reason: FlowReason } | null {
  switch (a.payee.type) {
    case "teacher":
      return { locationId: input.payerLocationId, reason: "teacher" };
    case "venue": {
      const packLoc = a.payee.packId !== undefined ? input.packLocationId?.(a.payee.packId) : null;
      return { locationId: packLoc ?? input.payerLocationId, reason: "venue" };
    }
    case "lessonFund":
      return { locationId: input.lessonLocationId, reason: "fund" };
    case "fund":
      return { locationId: a.payee.locationId, reason: "fund" };
    case "holder":
      return null;
  }
}

export function periodFlows(input: PeriodFlowsInput): Flow[] {
  const weights = pileWeights(input.income, input.piles, input.lessonLocationId);
  const acc = new Map<string, Flow>();

  for (const a of input.allocations) {
    const owner = ownerOf(a, input);
    if (!owner || a.amount === 0) continue;
    for (const w of weights) {
      if (w.locationId === owner.locationId) continue;
      let from = w.locationId;
      let to = owner.locationId;
      let amount = w.weight * a.amount;
      if (amount < 0) [from, to, amount] = [to, from, -amount];
      const key = `${from}>${to}>${owner.reason}`;
      const prev = acc.get(key);
      if (prev) prev.amount += amount;
      else acc.set(key, { from, to, amount, reason: owner.reason });
    }
  }

  return [...acc.values()]
    .map((f) => ({ ...f, amount: roundCents(f.amount) }))
    .filter((f) => f.amount !== 0);
}

/** 每個分部這堂留下多少（公積金＋剩下的），也就是「機構收入」。 */
export function branchIncome(input: PeriodFlowsInput): { locationId: number; amount: number }[] {
  const weights = pileWeights(input.income, input.piles, input.lessonLocationId);
  const acc = new Map<number, number>();
  const add = (loc: number, x: number) => acc.set(loc, (acc.get(loc) ?? 0) + x);

  for (const a of input.allocations) {
    if (a.payee.type === "lessonFund") add(input.lessonLocationId, a.amount);
    else if (a.payee.type === "fund") add(a.payee.locationId, a.amount);
    else if (a.payee.type === "holder") for (const w of weights) add(w.locationId, w.weight * a.amount);
  }
  return [...acc.entries()].map(([locationId, amount]) => ({ locationId, amount: roundCents(amount) }));
}

/**
 * 把一串「A 欠 B」互相抵掉，變成每一對分部之間的淨額（from < to 的順序不保證）。
 * 轉帳用 { from: 付錢的, to: 收錢的 } 傳進來時要先反過來（付了＝欠的減少）。
 */
export function netPairs(flows: { from: number; to: number; amount: number }[]) {
  const acc = new Map<string, number>();
  for (const f of flows) {
    const [a, b] = f.from < f.to ? [f.from, f.to] : [f.to, f.from];
    const sign = f.from < f.to ? 1 : -1;
    const key = `${a}:${b}`;
    acc.set(key, (acc.get(key) ?? 0) + sign * f.amount);
  }
  const out: { from: number; to: number; amount: number }[] = [];
  for (const [key, v] of acc) {
    const [a, b] = key.split(":").map(Number);
    const amount = roundCents(Math.abs(v));
    if (amount < 0.5) continue;
    out.push(v > 0 ? { from: a, to: b, amount } : { from: b, to: a, amount });
  }
  return out;
}
