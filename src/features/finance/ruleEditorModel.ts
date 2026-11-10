import type { Payee, ResolvedLine, RestTarget, SplitLine, SplitRule } from "@/domains/finance/types";
import { computeSplit } from "@/domains/finance/split";
import { formatMoney } from "@/lib/money";

/**
 * 表單的一列。最後一列固定是「剩下的」（rest），它同時帶著 fundLocationId：不夠扣時差額由哪個分部的公積金吸收。
 * 收入、老師、場地一律記在課程標的分部（Lesson.locationId），規則裡的公積金只決定剩下的錢給誰。
 */
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

/** 沒有規則時編輯器的起點：剩下的全部進這個分部的公積金。 */
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

/**
 * 「前面扣完剩下的」用一堂真實的收入當例子：第 i 行之前扣掉多少、剩多少。
 * `packUnit` = 這堂場地費（每次付的價或次數包單價；沒有就 0）。剩下的不會小於 0。
 */
export function remainingBeforeRow(
  rows: RuleRow[],
  index: number,
  income: number,
  packUnit: number,
): { deducted: number; remaining: number } {
  let remaining = income;
  for (const row of rows.slice(0, index)) {
    const amount =
      row.type === "fixed"
        ? row.amount
        : row.type === "venuePack"
          ? packUnit
          : row.type === "percentIncome"
            ? (row.pct / 100) * income
            : row.type === "percentRemaining"
              ? (row.pct / 100) * Math.max(0, remaining)
              : 0;
    remaining -= amount;
  }
  return { deducted: income - remaining, remaining: Math.max(0, remaining) };
}

/** 不夠扣時誰吸收：剩下的給公積金 → 那個公積金；給老師 → fundLocationId 那個分部的公積金（跟分帳引擎一樣）。 */
export const deficitFundOf = (rest: Extract<RuleRow, { type: "rest" }>): number =>
  rest.rest.type === "fund" ? rest.rest.locationId : rest.fundLocationId;

export const hasVenuePack = (rows: RuleRow[]) => rows.some((r) => r.type === "venuePack");

/** 規則在儲存前的檢查；回傳錯誤文字，沒問題回 null。 */
export function validateRows(rows: RuleRow[]): string | null {
  const rest = rows[rows.length - 1];
  if (!rest || rest.type !== "rest") return "缺少「剩下的」";
  if (rest.rest.type === "teachers" && rest.rest.shares.length === 0) return "「剩下的」至少選一位老師";
  if (rest.rest.type === "teachers" && rest.rest.shares.some((s) => !(s.weight > 0))) return "比重要大於 0";
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

/** 比重 → 佔剩下的幾 %（兩位都 1 → 50%）。 */
export const shareText = (weight: number, shares: { weight: number }[]) => {
  const total = shares.reduce((s, x) => s + x.weight, 0);
  return total > 0 ? `${Math.round((weight / total) * 1000) / 10}%` : "0%";
};

const pctText = (pct: number) => (Math.abs(pct - 100 / 3) < 1e-9 ? "1/3" : `${Math.round(pct * 100) / 100}%`);

/** 唯讀規則的一行文字，用 spec §4.3 的說法：「場地 $300 → 房東丁丁」。 */
export function describeRow(row: RuleRow, n: Namer): string {
  switch (row.type) {
    case "fixed":
      return row.to.type === "venue"
        ? `場地 $${row.amount} → ${n.payee(row.to)}`
        : `$${row.amount} → ${n.payee(row.to)}`;
    case "percentIncome":
      return `收入 ${pctText(row.pct)} → ${n.payee(row.to)}`;
    case "percentRemaining":
      return `剩下的 ${pctText(row.pct)} → ${n.payee(row.to)}`;
    case "venuePack":
      return `場地費 → ${n.venue(row.venueId)}`;
    case "rest":
      if (row.rest.type === "fund") return `剩下的 → ${n.location(row.rest.locationId)}公積金`;
      {
        const shares = row.rest.shares;
        return `剩下的 → ${shares
          .map((s) => (shares.length > 1 ? `${n.teacher(s.teacherId)} ${shareText(s.weight, shares)}` : n.teacher(s.teacherId)))
          .join("、")}`;
      }
  }
}

/** 比例的快選；⅓ 存成 100/3（不是 33.33），算出來才剛好三等分。 */
export const PCT_PRESETS: { label: string; pct: number }[] = [
  { label: "5%", pct: 5 },
  { label: "10%", pct: 10 },
  { label: "20%", pct: 20 },
  { label: "25%", pct: 25 },
  { label: "⅓", pct: 100 / 3 },
  { label: "50%", pct: 50 },
];

/** 新加一行「比例」的基準：第一行預設「這堂收入的」，後面的預設「前面扣完剩下的」。 */
export const newPercentRow = (existingLines: number, to: Payee): RuleRow =>
  existingLines === 0 ? { type: "percentIncome", pct: 0, to } : { type: "percentRemaining", pct: 0, to };

export type PreviewItem =
  | { kind: "payee"; payee: Payee; amount: number }
  /** 「場地費」行：amount null＝還不知道這個場地每次多少（沒設每次價也沒有包）。 */
  | { kind: "venuePack"; venueId: number; amount: number | null };

/** 場地每次多少（每次付的價，或目前這包的單價）；不知道 → null。見 venueBilling.ts venueUnit。 */
export type VenueUnitOf = (venueId: number) => number | null;

/** 「場地費」行換成固定金額（知道價錢的話）；不知道 → null。 */
function venueLine(line: Extract<SplitLine, { kind: "venuePack" }>, unitOf?: VenueUnitOf): ResolvedLine | null {
  const unit = unitOf?.(line.venueId) ?? null;
  return unit === null ? null : { kind: "fixed", amount: unit, to: { type: "venue", venueId: line.venueId } };
}

/**
 * 試算：用純分帳引擎（computeSplit）算一筆假設的收入。
 * 「場地費」行用場地的價錢（每次付的價，或目前這包的單價）；還不知道 → 列出來但不算金額（當 0 扣）。
 * 回傳每個對象的金額（同一個對象合併）和不夠扣的差額（>0 才有）。
 */
export function previewSplit(
  rows: RuleRow[],
  income: number,
  unitOf?: VenueUnitOf,
): { items: PreviewItem[]; deficit: number; deficitFund: number; unknownVenue: boolean } {
  const rule = rowsToRule(rows);
  // 每一行對到 resolved 的哪一筆（場地費價錢未知 → -1）
  const resolved: ResolvedLine[] = [];
  const slot: number[] = [];
  for (const line of rule.lines) {
    const r = line.kind === "venuePack" ? venueLine(line, unitOf) : line;
    if (r === null) slot.push(-1);
    else {
      slot.push(resolved.length);
      resolved.push(r);
    }
  }
  const allocations = computeSplit(income, resolved, rule.rest, rule.fundLocationId);
  const items: PreviewItem[] = [];
  const add = (payee: Payee, amount: number) => {
    const key = payeeKey(payee);
    const same = items.find((i): i is Extract<PreviewItem, { kind: "payee" }> => i.kind === "payee" && payeeKey(i.payee) === key);
    if (same) same.amount += amount;
    else items.push({ kind: "payee", payee, amount });
  };
  // 前 resolved.length 筆是各行（照順序），後面是剩下的／差額
  rule.lines.forEach((line, i) => {
    if (line.kind === "venuePack") {
      items.push({ kind: "venuePack", venueId: line.venueId, amount: slot[i] < 0 ? null : allocations[slot[i]].amount });
    } else add(allocations[slot[i]].payee, allocations[slot[i]].amount);
  });
  let deficit = 0;
  let deficitFund = rule.fundLocationId;
  for (const a of allocations.slice(resolved.length)) {
    if (a.source === "deficit") {
      deficit = -a.amount;
      if (a.payee.type === "fund") deficitFund = a.payee.locationId;
    } else add(a.payee, a.amount);
  }
  return {
    items,
    deficit: Math.max(0, deficit),
    deficitFund,
    unknownVenue: items.some((i) => i.kind === "venuePack" && i.amount === null),
  };
}

/** 照規則扣完後剩多少（不夾 0；負的 = 不夠扣）。「場地費」行換成場地的價錢（不知道 → 當 0）。 */
function finalRemaining(lines: RuleRow[], income: number, unitOf?: VenueUnitOf): number {
  let remaining = income;
  for (const row of lines) {
    if (row.type === "fixed") remaining -= row.amount;
    else if (row.type === "venuePack") remaining -= unitOf?.(row.venueId) ?? 0;
    else if (row.type === "percentIncome") remaining -= (row.pct / 100) * income;
    else if (row.type === "percentRemaining") remaining -= (row.pct / 100) * Math.max(0, remaining);
  }
  return remaining;
}

export type RuleCheck = { ok: boolean; text: string };

const EPS = 1e-9;

/**
 * 儲存前的一句即時檢查：這條規則分不分得完（試算列的是單一金額，這句講整條規則）。
 * - 「這堂收入的」比例合計超過 100% → 一定不夠扣
 * - 有固定金額 → 收入低於某個數就不夠扣（算出那個數）
 * - 否則分得完：比例合計（「前面扣完剩下的」換算成佔收入幾 %）、剩下的給誰
 * 差額由誰吸收跟分帳引擎一樣：剩下的給公積金 → 那個公積金，否則 fundLocationId 那個分部的公積金。
 * 「場地費」行算成固定金額（場地每次多少）；不知道價錢就不算進來（試算那邊有說）。
 * 句子裡叫「場地費」／「固定金額」／「場地費＋固定金額」；門檻因為先抽的比例變高時，把比例講出來。
 */
export function checkRule(rows: RuleRow[], n: Pick<Namer, "teacher" | "location">, unitOf?: VenueUnitOf): RuleCheck | null {
  const rest = rows[rows.length - 1];
  if (!rest || rest.type !== "rest") return null;
  const lines = rows.slice(0, -1);
  const fund = `${n.location(deficitFundOf(rest))}公積金`;
  const pctIncome = lines.reduce((s, r) => s + (r.type === "percentIncome" ? r.pct : 0), 0);
  // 場地費（場地費行、付給場地的固定金額）和其他固定金額分開算，句子裡才叫得出是哪一種
  const venueFee = lines.reduce(
    (s, r) => s + (r.type === "venuePack" ? (unitOf?.(r.venueId) ?? 0) : r.type === "fixed" && r.to.type === "venue" ? r.amount : 0),
    0,
  );
  const otherFixed = lines.reduce((s, r) => s + (r.type === "fixed" && r.to.type !== "venue" ? r.amount : 0), 0);
  const fixed = venueFee + otherFixed;
  const fixedLabel = venueFee > 0 && otherFixed > 0 ? "場地費＋固定金額" : venueFee > 0 ? "場地費" : "固定金額";
  const round = (x: number) => Math.round(x * 100) / 100;

  if (pctIncome > 100 + EPS) {
    return { ok: false, text: `比例合計 ${round(pctIncome)}%，超過的部分由${fund}吸收` };
  }
  if (fixed > 0) {
    if (pctIncome >= 100 - EPS) {
      return { ok: false, text: `比例已是收入的 100%，${fixedLabel} $${formatMoney(fixed)} 一定由${fund}吸收` };
    }
    // 最少收多少才扣得完：扣完剩的隨收入遞增 → 二分找門檻（整數元）
    let lo = 0;
    let hi = Math.ceil(fixed / (1 - pctIncome / 100)) + 1;
    while (finalRemaining(lines, hi, unitOf) < -EPS) hi *= 2;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (finalRemaining(lines, mid, unitOf) >= -EPS) hi = mid;
      else lo = mid + 1;
    }
    // 門檻比合計高，是因為前面先抽了比例：說出來，不然看不懂為什麼不是合計那個數
    const extra = pctIncome > EPS ? `加上先抽的 ${round(pctIncome)}%` : "加上前面先抽的比例";
    return {
      ok: false,
      text:
        lo === Math.ceil(fixed)
          ? `${fixedLabel}合計 $${formatMoney(fixed)}，這堂收入低於這個數時由${fund}吸收`
          : `${fixedLabel}合計 $${formatMoney(fixed)}，${extra}，這堂收入低於 $${formatMoney(lo)} 時由${fund}吸收`,
    };
  }

  const taken = round(100 - finalRemaining(lines, 100, unitOf));
  const to =
    rest.rest.type === "fund"
      ? `${n.location(rest.rest.locationId)}公積金`
      : rest.rest.shares.map((s) => n.teacher(s.teacherId)).join("、");
  if (!to) return null; // 還沒選老師：validateRows 會講
  if (taken >= 100 - EPS) return { ok: false, text: `比例合計 100%，剩下的 ${to} 拿 0` };
  if (taken <= EPS) return { ok: true, text: `分得完：全部給 ${to}` };
  return { ok: true, text: `分得完：比例合計 ${taken}%，剩下的給 ${to}` };
}
