import type { Allocation, Payee, ResolvedLine, RestTarget } from "./types";

/**
 * 純函式分帳引擎（從 feat/finance-v2 搬來）：由上而下扣每一行，再分剩下的。
 * 老師最少拿 0；收入不夠付時的差額（負數）記給：rest 是分部（含 holder）→ 那裡，
 * rest 是老師 → 開課分部公積金。輸出加總永遠等於 income。
 */
export function computeSplit(
  income: number,
  lines: ResolvedLine[],
  rest: RestTarget,
): Allocation[] {
  const out: Allocation[] = [];
  let remaining = income;

  for (const line of lines) {
    const amount =
      line.kind === "fixed"
        ? line.amount
        : (line.pct / 100) * (line.base === "income" ? income : Math.max(0, remaining));
    out.push({ payee: line.to, amount, source: "line" });
    remaining -= amount;
  }

  if (rest.type === "teachers") {
    const total = rest.shares.reduce((s, x) => s + x.weight, 0);
    for (const s of rest.shares) {
      out.push({
        payee: { type: "teacher", teacherId: s.teacherId },
        amount: remaining >= 0 ? (remaining * s.weight) / total : 0,
        source: "rest",
      });
    }
    if (remaining < 0) {
      out.push({ payee: { type: "lessonFund" }, amount: remaining, source: "deficit" });
    }
    return out;
  }

  const payee: Payee = rest;
  out.push({ payee, amount: remaining, source: remaining >= 0 ? "rest" : "deficit" });
  return out;
}
