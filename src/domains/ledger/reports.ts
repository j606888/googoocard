// 報表（docs/finance-v2/05 §3.2–3.6）：全部從分錄行加總。純函式，金額單位「分」。
import { isDebitNormal, type LedgerAccountType } from "./accounts";
import { addDays } from "./lines";

export type AccountMeta = {
  id: number;
  code: string;
  name: string;
  type: LedgerAccountType;
  systemKey: string | null;
  parentId: number | null;
};

export type LedgerRow = {
  entryId: number;
  date: string; // YYYY-MM-DD
  accountId: number;
  locationId: number;
  amount: number; // 分；借正貸負
  partyType: string | null;
  partyId: number | null;
  lessonPeriodId: number | null;
  sourceType: string | null; // null = 期初／手動
  entryKind: string;
};

export type Range = { from: string; to: string }; // 含頭含尾

const inRange = (d: string, r: Range) => d >= r.from && d <= r.to;
const sum = (rows: LedgerRow[]) => rows.reduce((s, r) => s + r.amount, 0);

/** 以正常餘額方向顯示：資產、費用借方為正；負債、權益、收入貸方為正。 */
export function natural(type: LedgerAccountType, amount: number): number {
  return isDebitNormal(type) ? amount : -amount;
}

function byLocation<T>(locationIds: number[], f: (locationId: number | null) => T): { byLocation: Record<number, T>; total: T } {
  const out: Record<number, T> = {};
  for (const id of locationIds) out[id] = f(id);
  return { byLocation: out, total: f(null) };
}

// ---------------------------------------------------------------------------
// 試算表
// ---------------------------------------------------------------------------
export type TrialBalanceRow = { accountId: number; code: string; name: string; type: LedgerAccountType; debit: number; credit: number; balance: number };

export function trialBalance(rows: LedgerRow[], accounts: AccountMeta[], asOf: string, locationId?: number): { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number } {
  const m = new Map<number, { debit: number; credit: number }>();
  for (const r of rows) {
    if (r.date > asOf || (locationId !== undefined && r.locationId !== locationId)) continue;
    const cur = m.get(r.accountId) ?? { debit: 0, credit: 0 };
    if (r.amount >= 0) cur.debit += r.amount;
    else cur.credit -= r.amount;
    m.set(r.accountId, cur);
  }
  const out: TrialBalanceRow[] = accounts
    .filter((a) => m.has(a.id))
    .map((a) => {
      const { debit, credit } = m.get(a.id)!;
      return { accountId: a.id, code: a.code, name: a.name, type: a.type, debit, credit, balance: debit - credit };
    })
    .sort((a, b) => (a.code < b.code ? -1 : 1));
  return {
    rows: out,
    totalDebit: out.reduce((s, r) => s + Math.max(0, r.balance), 0),
    totalCredit: out.reduce((s, r) => s + Math.max(0, -r.balance), 0),
  };
}

// ---------------------------------------------------------------------------
// 損益表
// ---------------------------------------------------------------------------
export type PnlLine = { accountId: number; code: string; name: string; byLocation: Record<number, number>; total: number };
export type PnlSection = { lines: PnlLine[]; byLocation: Record<number, number>; total: number };
export type Pnl = {
  income: PnlSection;
  directCosts: PnlSection; // 老師報酬、場地費
  grossProfit: { byLocation: Record<number, number>; total: number };
  expenses: PnlSection; // 營業費用與其他費用
  netIncome: { byLocation: Record<number, number>; total: number };
};

const DIRECT = new Set(["EXPENSE_TEACHER", "EXPENSE_VENUE"]);

export function profitAndLoss(rows: LedgerRow[], accounts: AccountMeta[], range: Range, locationIds: number[]): Pnl {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const relevant = rows.filter((r) => inRange(r.date, range) && (acc.get(r.accountId)?.type === "INCOME" || acc.get(r.accountId)?.type === "EXPENSE"));

  const section = (pred: (a: AccountMeta) => boolean): PnlSection => {
    const ids = [...new Set(relevant.filter((r) => pred(acc.get(r.accountId)!)).map((r) => r.accountId))];
    const lines = ids
      .map((id) => {
        const a = acc.get(id)!;
        const mine = relevant.filter((r) => r.accountId === id);
        const v = byLocation(locationIds, (loc) => natural(a.type, sum(loc === null ? mine : mine.filter((r) => r.locationId === loc))));
        return { accountId: id, code: a.code, name: a.name, ...v };
      })
      .filter((l) => l.total !== 0 || Object.values(l.byLocation).some((x) => x !== 0))
      .sort((a, b) => (a.code < b.code ? -1 : 1));
    const tot = byLocation(locationIds, (loc) => lines.reduce((s, l) => s + (loc === null ? l.total : (l.byLocation[loc] ?? 0)), 0));
    return { lines, ...tot };
  };

  const income = section((a) => a.type === "INCOME");
  const directCosts = section((a) => a.type === "EXPENSE" && DIRECT.has(a.systemKey ?? ""));
  const expenses = section((a) => a.type === "EXPENSE" && !DIRECT.has(a.systemKey ?? ""));
  const diff = (a: { byLocation: Record<number, number>; total: number }, b: { byLocation: Record<number, number>; total: number }) =>
    byLocation(locationIds, (loc) => (loc === null ? a.total - b.total : (a.byLocation[loc] ?? 0) - (b.byLocation[loc] ?? 0)));
  const grossProfit = diff(income, directCosts);
  const netIncome = diff(grossProfit, expenses);
  return { income, directCosts, grossProfit, expenses, netIncome };
}

// ---------------------------------------------------------------------------
// 資產負債表
// ---------------------------------------------------------------------------
export type BsLine = { key: string; label: string; byLocation: Record<number, number>; total: number };
export type BalanceSheet = {
  asOf: string;
  assets: BsLine[];
  liabilities: BsLine[];
  equity: BsLine[];
  totals: { assets: BsLine; liabilities: BsLine; equity: BsLine };
  balanced: boolean;
};

export function balanceSheet(rows: LedgerRow[], accounts: AccountMeta[], asOf: string, locationIds: number[]): BalanceSheet {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const upTo = rows.filter((r) => r.date <= asOf);

  const lineFor = (key: string, label: string, pred: (r: LedgerRow, a: AccountMeta) => boolean, sign: 1 | -1): BsLine => {
    const mine = upTo.filter((r) => pred(r, acc.get(r.accountId)!));
    return { key, label, ...byLocation(locationIds, (loc) => sign * sum(loc === null ? mine : mine.filter((r) => r.locationId === loc))) };
  };

  const cashChildren = accounts.filter((a) => a.parentId !== null && acc.get(a.parentId)?.systemKey === "CASH");
  const cashChildIds = new Set(cashChildren.map((a) => a.id));
  const assetAccounts = accounts.filter(
    (a) => a.type === "ASSET" && a.systemKey !== "CASH" && a.systemKey !== "INTERBRANCH" && !cashChildIds.has(a.id),
  );
  const interbranch = accounts.find((a) => a.systemKey === "INTERBRANCH");

  const assets: BsLine[] = [
    ...cashChildren.map((a) => lineFor(`A:${a.id}`, a.name, (r) => r.accountId === a.id, 1)),
    ...assetAccounts.map((a) => lineFor(`A:${a.id}`, a.name, (r) => r.accountId === a.id, 1)),
  ];
  const liabilities: BsLine[] = accounts
    .filter((a) => a.type === "LIABILITY")
    .map((a) => lineFor(`A:${a.id}`, a.name, (r) => r.accountId === a.id, -1));
  if (interbranch) {
    // 分部往來：借方餘額（別的分部欠我）算資產，貸方餘額（我欠別的分部）算負債；全教室合計為 0。
    const mine = upTo.filter((r) => r.accountId === interbranch.id);
    const at = (loc: number | null) => sum(loc === null ? mine : mine.filter((r) => r.locationId === loc));
    assets.push({ key: "IB+", label: "分部往來（應收）", ...byLocation(locationIds, (loc) => Math.max(0, at(loc))) });
    liabilities.push({ key: "IB-", label: "分部往來（應付）", ...byLocation(locationIds, (loc) => Math.max(0, -at(loc))) });
    // 全教室互相抵銷
    assets[assets.length - 1].total = Math.max(0, at(null));
    liabilities[liabilities.length - 1].total = Math.max(0, -at(null));
  }

  const isPnl = (a: AccountMeta) => a.type === "INCOME" || a.type === "EXPENSE";
  const equity: BsLine[] = [
    ...accounts
      .filter((a) => a.type === "EQUITY" && a.systemKey !== "RETAINED_EARNINGS" && a.systemKey !== "OPENING_EQUITY")
      .map((a) => lineFor(`A:${a.id}`, a.name, (r) => r.accountId === a.id, -1)),
    lineFor(
      "FUND",
      "公積金（累積盈餘）",
      (r, a) => isPnl(a) || a.systemKey === "RETAINED_EARNINGS" || a.systemKey === "OPENING_EQUITY",
      -1,
    ),
  ];

  const nonZero = (ls: BsLine[]) => ls.filter((l) => l.total !== 0 || Object.values(l.byLocation).some((x) => x !== 0));
  const total = (key: string, label: string, ls: BsLine[]): BsLine => ({
    key,
    label,
    ...byLocation(locationIds, (loc) => ls.reduce((s, l) => s + (loc === null ? l.total : (l.byLocation[loc] ?? 0)), 0)),
  });
  const A = nonZero(assets);
  const L = nonZero(liabilities);
  const E = equity.filter((l) => l.key === "FUND" || l.total !== 0 || Object.values(l.byLocation).some((x) => x !== 0));
  const totals = { assets: total("ASSETS", "資產合計", A), liabilities: total("LIABILITIES", "負債合計", L), equity: total("EQUITY", "權益合計", E) };
  const balanced =
    totals.assets.total === totals.liabilities.total + totals.equity.total &&
    locationIds.every((id) => totals.assets.byLocation[id] === totals.liabilities.byLocation[id] + totals.equity.byLocation[id]);
  return { asOf, assets: A, liabilities: L, equity: E, totals, balanced };
}

// ---------------------------------------------------------------------------
// 現金流量（直接法，小教室版）
// ---------------------------------------------------------------------------
export type CashFlowCategory =
  | "TUITION" // 收學費
  | "DROP_IN" // 收單堂
  | "REFUND" // 退費
  | "EXPENSE" // 支出
  | "VENUE_PACK" // 買次數包
  | "PAYOUT" // 付老師、場地、業主
  | "TRANSFER" // 資金帳戶之間（全教室合計 0）
  | "OWNER" // 業主投入／提取
  | "CASH_COUNT" // 盤點差額
  | "MANUAL" // 手動分錄、沖銷
  | "OPENING" // 期初
  | "OTHER";

export type CashFlow = {
  opening: { byLocation: Record<number, number>; total: number };
  flows: { category: CashFlowCategory; byLocation: Record<number, number>; total: number }[];
  closing: { byLocation: Record<number, number>; total: number };
};

function cashCategory(r: LedgerRow): CashFlowCategory {
  switch (r.sourceType) {
    case "CARD":
      return r.amount >= 0 ? "TUITION" : "REFUND";
    case "PERIOD":
      return "DROP_IN";
    case "EXPENSE":
      return "EXPENSE";
    case "VENUE_PACK":
      return "VENUE_PACK";
    case "PAYOUT":
      return "PAYOUT";
    case "MONEY_TRANSFER":
      return "TRANSFER";
    case "OWNER_TXN":
      return "OWNER";
    case "CASH_COUNT":
      return "CASH_COUNT";
    case null:
      return r.entryKind === "OPENING" ? "OPENING" : r.entryKind === "MANUAL" || r.entryKind === "REVERSAL" ? "MANUAL" : "OTHER";
    default:
      return "OTHER";
  }
}

export function cashFlow(rows: LedgerRow[], accounts: AccountMeta[], range: Range, locationIds: number[]): CashFlow {
  const cashParent = accounts.find((a) => a.systemKey === "CASH")?.id;
  const cashIds = new Set(accounts.filter((a) => a.parentId === cashParent || a.id === cashParent).map((a) => a.id));
  const cash = rows.filter((r) => cashIds.has(r.accountId));
  const at = (pred: (r: LedgerRow) => boolean) => (loc: number | null) =>
    sum(cash.filter((r) => pred(r) && (loc === null || r.locationId === loc)));

  const opening = byLocation(locationIds, at((r) => r.date < range.from));
  const closing = byLocation(locationIds, at((r) => r.date <= range.to));
  const inside = cash.filter((r) => inRange(r.date, range));
  const cats = [...new Set(inside.map(cashCategory))];
  const order: CashFlowCategory[] = ["OPENING", "TUITION", "DROP_IN", "REFUND", "PAYOUT", "VENUE_PACK", "EXPENSE", "OWNER", "TRANSFER", "CASH_COUNT", "MANUAL", "OTHER"];
  const flows = order
    .filter((c) => cats.includes(c))
    .map((category) => ({ category, ...byLocation(locationIds, at((r) => inRange(r.date, range) && cashCategory(r) === category)) }));
  return { opening, flows, closing };
}

// ---------------------------------------------------------------------------
// 預收餘額（rollforward）
// ---------------------------------------------------------------------------
export type DeferredRollforward = {
  opening: number;
  sold: number; // 賣卡、轉換轉入、期初分錄（期間內開帳）
  recognized: number; // 上課認列
  closed: number; // 到期、作廢、退費、轉出
  closing: number;
  cards: { cardId: number; balance: number }[]; // 期末還有預收的卡
};

export function deferredRollforward(rows: LedgerRow[], accounts: AccountMeta[], range: Range, locationId?: number): DeferredRollforward {
  const id = accounts.find((a) => a.systemKey === "DEFERRED_REVENUE")?.id;
  const d = rows.filter((r) => r.accountId === id && (locationId === undefined || r.locationId === locationId));
  const liab = (rs: LedgerRow[]) => -sum(rs);
  const inside = d.filter((r) => inRange(r.date, range));
  const byCard = new Map<number, number>();
  for (const r of d) {
    if (r.date > range.to || r.partyType !== "STUDENT_CARD" || r.partyId === null) continue;
    byCard.set(r.partyId, (byCard.get(r.partyId) ?? 0) - r.amount);
  }
  return {
    opening: liab(d.filter((r) => r.date < range.from)),
    sold: liab(inside.filter((r) => r.amount < 0)),
    recognized: -liab(inside.filter((r) => r.amount > 0 && r.sourceType === "PERIOD")),
    closed: -liab(inside.filter((r) => r.amount > 0 && r.sourceType !== "PERIOD")),
    closing: liab(d.filter((r) => r.date <= range.to)),
    cards: [...byCard].filter(([, v]) => v !== 0).map(([cardId, balance]) => ({ cardId, balance })).sort((a, b) => b.balance - a.balance),
  };
}

// ---------------------------------------------------------------------------
// 子帳：應收帳齡、應付明細
// ---------------------------------------------------------------------------
export type PartyBalance = { partyType: string; partyId: number; locationId: number; balance: number; since: string; ageDays: number };

/** 某科目依對象的餘額（以正常方向為正），since＝最早一筆未沖完的日期（近似：第一筆借／貸的日期）。 */
export function partyBalances(rows: LedgerRow[], accountIds: number[], asOf: string, type: LedgerAccountType): PartyBalance[] {
  const ids = new Set(accountIds);
  const m = new Map<string, PartyBalance & { first: string }>();
  for (const r of rows) {
    if (!ids.has(r.accountId) || r.date > asOf || r.partyType === null || r.partyId === null) continue;
    const k = `${r.partyType}:${r.partyId}:${r.locationId}`;
    const cur = m.get(k) ?? { partyType: r.partyType, partyId: r.partyId, locationId: r.locationId, balance: 0, since: r.date, ageDays: 0, first: r.date };
    cur.balance += natural(type, r.amount);
    if (r.date < cur.first) cur.first = r.date;
    m.set(k, cur);
  }
  const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  return [...m.values()]
    .filter((p) => p.balance !== 0)
    .map(({ first, ...p }) => ({ ...p, since: first, ageDays: days(first, asOf) }))
    .sort((a, b) => b.ageDays - a.ageDays || b.balance - a.balance);
}

export function agingBucket(ageDays: number): "0-30" | "31-60" | "60+" {
  return ageDays <= 30 ? "0-30" : ageDays <= 60 ? "31-60" : "60+";
}

// ---------------------------------------------------------------------------
// 課程獲利（每堂）
// ---------------------------------------------------------------------------
export type PeriodProfit = { lessonPeriodId: number; date: string; locationId: number; revenue: number; teacher: number; venue: number; gross: number };

export function periodProfits(rows: LedgerRow[], accounts: AccountMeta[], range: Range): PeriodProfit[] {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const m = new Map<number, PeriodProfit>();
  for (const r of rows) {
    if (r.lessonPeriodId === null || !inRange(r.date, range)) continue;
    const a = acc.get(r.accountId)!;
    if (a.type !== "INCOME" && a.type !== "EXPENSE") continue;
    const cur = m.get(r.lessonPeriodId) ?? { lessonPeriodId: r.lessonPeriodId, date: r.date, locationId: r.locationId, revenue: 0, teacher: 0, venue: 0, gross: 0 };
    if (a.type === "INCOME") cur.revenue -= r.amount;
    else if (a.systemKey === "EXPENSE_TEACHER") cur.teacher += r.amount;
    else if (a.systemKey === "EXPENSE_VENUE") cur.venue += r.amount;
    if (r.date < cur.date) cur.date = r.date;
    m.set(r.lessonPeriodId, cur);
  }
  return [...m.values()].map((p) => ({ ...p, gross: p.revenue - p.teacher - p.venue })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------------------------------------------------------------------------
// 總分類帳（某科目明細）
// ---------------------------------------------------------------------------
export type GlLine = LedgerRow & { running: number };

export function generalLedger(rows: LedgerRow[], account: AccountMeta, childIds: number[], range: Range, locationId?: number): { opening: number; lines: GlLine[]; closing: number } {
  const ids = new Set([account.id, ...childIds]);
  const mine = rows
    .filter((r) => ids.has(r.accountId) && (locationId === undefined || r.locationId === locationId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.entryId - b.entryId));
  let running = natural(account.type, sum(mine.filter((r) => r.date < range.from)));
  const opening = running;
  const lines: GlLine[] = [];
  for (const r of mine.filter((r) => inRange(r.date, range))) {
    running += natural(account.type, r.amount);
    lines.push({ ...r, running });
  }
  return { opening, lines, closing: running };
}

/** 月份字串 YYYY-MM → 區間。 */
export function monthRange(month: string): Range {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, to: addDays(next, -1) };
}
