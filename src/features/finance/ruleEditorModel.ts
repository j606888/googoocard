import type { Payee, RestTarget, SplitLine, SplitRule } from "@/domains/finance/types";

/** 表單的一列。最後一列固定是「剩下的」（rest），它同時帶著這堂課的基金分部。 */
export type RuleRow =
  | { type: "fixed"; amount: number; to: Payee }
  | { type: "percentIncome"; pct: number; to: Payee }
  | { type: "percentRemaining"; pct: number; to: Payee }
  | { type: "venuePack"; venueId: number }
  | { type: "rest"; rest: RestTarget; fundLocationId: number };

export function ruleToRows(rule: SplitRule): RuleRow[] {
  const rows: RuleRow[] = rule.lines.map((line): RuleRow => {
    switch (line.kind) {
      case "fixed":
        return { type: "fixed", amount: line.amount, to: line.to };
      case "percent":
        return line.base === "income"
          ? { type: "percentIncome", pct: line.pct, to: line.to }
          : { type: "percentRemaining", pct: line.pct, to: line.to };
      case "venuePack":
        return { type: "venuePack", venueId: line.venueId };
    }
  });
  rows.push({ type: "rest", rest: rule.rest, fundLocationId: rule.fundLocationId });
  return rows;
}

export function rowsToRule(rows: RuleRow[]): SplitRule {
  const last = rows[rows.length - 1];
  if (!last || last.type !== "rest") throw new Error("the last row must be 剩下的");
  const lines: SplitLine[] = rows.slice(0, -1).map((row): SplitLine => {
    switch (row.type) {
      case "fixed":
        return { kind: "fixed", amount: row.amount, to: row.to };
      case "percentIncome":
        return { kind: "percent", pct: row.pct, base: "income", to: row.to };
      case "percentRemaining":
        return { kind: "percent", pct: row.pct, base: "remaining", to: row.to };
      case "venuePack":
        return { kind: "venuePack", venueId: row.venueId };
      case "rest":
        throw new Error("only the last row can be 剩下的");
    }
  });
  return { lines, rest: last.rest, fundLocationId: last.fundLocationId };
}

/** 沒有規則時編輯器的起點：全部進這堂課的基金。 */
export function emptyRows(fundLocationId: number): RuleRow[] {
  return [{ type: "rest", rest: { type: "fund", locationId: fundLocationId }, fundLocationId }];
}

export const payeeKey = (p: Payee): string =>
  p.type === "teacher" ? `t:${p.teacherId}` : p.type === "fund" ? `f:${p.locationId}` : `v:${p.venueId}`;

export function payeeFromKey(key: string, previous?: Payee): Payee {
  const n = Number(key.slice(2));
  if (key.startsWith("t:")) return { type: "teacher", teacherId: n };
  if (key.startsWith("f:")) return { type: "fund", locationId: n };
  // 同一個場地沿用原本的 packId
  return previous?.type === "venue" && previous.venueId === n
    ? previous
    : { type: "venue", venueId: n };
}

export const hasVenuePack = (rows: RuleRow[]) => rows.some((r) => r.type === "venuePack");

/** 規則在儲存前的檢查；回傳錯誤文字，沒問題回 null。 */
export function validateRows(rows: RuleRow[]): string | null {
  const rest = rows[rows.length - 1];
  if (!rest || rest.type !== "rest") return "缺少「剩下的」";
  if (rest.rest.type === "teachers" && rest.rest.shares.length === 0) return "「剩下的」至少選一位老師";
  for (const r of rows) {
    if ((r.type === "percentIncome" || r.type === "percentRemaining") && !(r.pct >= 0 && r.pct <= 100)) {
      return "比例要在 0 到 100 之間";
    }
    if (r.type === "fixed" && !(r.amount >= 0)) return "金額不能是負的";
  }
  return null;
}

type Namer = {
  payee: (p: Payee) => string;
  venue: (id: number) => string;
  teacher: (id: number) => string;
  location: (id: number) => string;
};

const pctText = (pct: number) => (Math.abs(pct - 100 / 3) < 1e-9 ? "1/3" : `${Math.round(pct * 100) / 100}%`);

/** 唯讀規則的一行文字，用 spec §4.3 的說法：「場地 $300 → 房東丁丁」。 */
export function describeRow(row: RuleRow, n: Namer): string {
  switch (row.type) {
    case "fixed":
      return `$${row.amount} → ${n.payee(row.to)}`;
    case "percentIncome":
      return `收入 ${pctText(row.pct)} → ${n.payee(row.to)}`;
    case "percentRemaining":
      return `剩下的 ${pctText(row.pct)} → ${n.payee(row.to)}`;
    case "venuePack":
      return `場地次數包（${n.venue(row.venueId)}）`;
    case "rest":
      return row.rest.type === "fund"
        ? `剩下的 → ${n.location(row.rest.locationId)}公積金`
        : `剩下的 → ${row.rest.shares
            .map((s) => (row.rest.type === "teachers" && row.rest.shares.length > 1 ? `${n.teacher(s.teacherId)} ×${s.weight}` : n.teacher(s.teacherId)))
            .join("、")}`;
  }
}
