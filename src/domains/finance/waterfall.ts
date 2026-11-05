import type { Allocation } from "./types";

/** 分部 id，或「全教室」。 */
export type BranchScope = number | "all";

type WaterfallPeriod = {
  lessonId: number;
  lessonName: string;
  locationId: number | null;
  /** 舊的鎖住結算單沒有這個欄位 → 用上課分部。 */
  fundLocationId?: number | null;
  income: { total: number };
  allocations: Allocation[] | null;
};

export type WaterfallInput = {
  periods: WaterfallPeriod[];
  byBranch: { locationId: number | null; expenses: number; fundChange: number }[];
};

export type Waterfall = {
  /** 已實現收入（這個月上過、已付款） */
  income: number;
  teachers: number;
  venues: number;
  /** 各堂分到公積金的錢（含不夠付時的負數） */
  fund: number;
  /** 沒有分帳規則的課的收入（還沒分給誰） */
  unallocated: number;
  /** 過期收入、結算後的調整、發錢取整的零頭 */
  other: number;
  expenses: number;
  /** 本月淨變化 ＝ 公積金這個月的變化 */
  net: number;
  lessons: { lessonId: number; lessonName: string; periods: number; income: number }[];
};

const fundOf = (p: WaterfallPeriod) => (p.fundLocationId === undefined ? p.locationId : p.fundLocationId);

/**
 * 首頁的本月收支瀑布：收入 → 老師 → 場地 → 進公積金 → 支出 → 本月淨變化。
 * 分部依「這堂課的基金」歸類，不依上課地點（spec「週日課」）。
 * 淨變化直接取結算單的公積金變化，所以永遠跟結算單一致；`other` 是兩者的差（過期收入、調整、零頭）。
 */
export function monthWaterfall(input: WaterfallInput, scope: BranchScope): Waterfall {
  const inScope = (locationId: number | null) => scope === "all" || locationId === scope;
  const periods = input.periods.filter((p) => inScope(fundOf(p)));

  let income = 0;
  let teachers = 0;
  let venues = 0;
  let unallocated = 0;
  const lessons = new Map<number, Waterfall["lessons"][number]>();
  for (const p of periods) {
    income += p.income.total;
    if (p.allocations === null) unallocated += p.income.total;
    for (const a of p.allocations ?? []) {
      if (a.payee.type === "teacher") teachers += a.amount;
      else if (a.payee.type === "venue") venues += a.amount;
    }
    const l = lessons.get(p.lessonId) ?? { lessonId: p.lessonId, lessonName: p.lessonName, periods: 0, income: 0 };
    l.periods += 1;
    l.income += p.income.total;
    lessons.set(p.lessonId, l);
  }

  // 進公積金看錢進了哪個分部的公積金（跟結算單的公積金變化同一個口徑）。
  let fund = 0;
  for (const p of input.periods) {
    for (const a of p.allocations ?? []) {
      if (a.payee.type === "fund" && inScope(a.payee.locationId)) fund += a.amount;
    }
  }

  const branches = input.byBranch.filter((b) => inScope(b.locationId));
  const expenses = branches.reduce((s, b) => s + b.expenses, 0);
  const net = branches.reduce((s, b) => s + b.fundChange, 0);

  return {
    income,
    teachers,
    venues,
    fund,
    unallocated,
    other: net - fund + expenses,
    expenses,
    net,
    lessons: [...lessons.values()].sort((a, b) => b.income - a.income || a.lessonId - b.lessonId),
  };
}

/**
 * 顯示用：每列取到整數，而且加減要對得上（spec 票 23）。
 * 收入、老師、場地、還沒分帳、支出、本月淨變化各自四捨五入；
 * 進公積金在上半段本來就對得上時（只差零頭）改用上半段的整數相減，否則照實取整；
 * 「過期收入與調整」吃掉剩下的尾差 ＝ 本月淨變化 − 進公積金 ＋ 支出，所以 |值| < 0.5 的零頭不會單獨冒出來。
 */
export function roundWaterfall(w: Waterfall): Waterfall {
  const r = Math.round;
  const income = r(w.income);
  const teachers = r(w.teachers);
  const venues = r(w.venues);
  const unallocated = r(w.unallocated);
  const expenses = r(w.expenses);
  const net = r(w.net);
  const topAddsUp = Math.abs(w.income - w.teachers - w.venues - w.unallocated - w.fund) < 0.5;
  const fund = topAddsUp ? income - teachers - venues - unallocated : r(w.fund);
  return { ...w, income, teachers, venues, unallocated, fund, expenses, net, other: net - fund + expenses };
}
