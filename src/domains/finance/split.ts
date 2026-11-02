import type { Allocation, ResolvedLine, RestTarget } from "./types";

/** Pure split engine: top-down lines, then the rest; people floor at 0, deficit goes to a fund. */
export function computeSplit(
  income: number,
  lines: ResolvedLine[],
  rest: RestTarget,
  fundLocationId: number,
): Allocation[] {
  const out: Allocation[] = [];
  let remaining = income;

  for (const line of lines) {
    const amount =
      line.kind === "fixed"
        ? line.amount
        : (line.pct / 100) *
          (line.base === "income" ? income : Math.max(0, remaining));
    out.push({ payee: line.to, amount, source: "line" });
    remaining -= amount;
  }

  if (remaining >= 0) {
    if (rest.type === "fund") {
      out.push({
        payee: { type: "fund", locationId: rest.locationId },
        amount: remaining,
        source: "rest",
      });
    } else {
      const total = rest.shares.reduce((s, x) => s + x.weight, 0);
      for (const s of rest.shares) {
        out.push({
          payee: { type: "teacher", teacherId: s.teacherId },
          amount: (remaining * s.weight) / total,
          source: "rest",
        });
      }
    }
  } else {
    if (rest.type === "teachers") {
      for (const s of rest.shares) {
        out.push({
          payee: { type: "teacher", teacherId: s.teacherId },
          amount: 0,
          source: "rest",
        });
      }
    }
    out.push({
      payee: {
        type: "fund",
        locationId: rest.type === "fund" ? rest.locationId : fundLocationId,
      },
      amount: remaining,
      source: "deficit",
    });
  }
  return out;
}
