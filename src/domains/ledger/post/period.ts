// 時段來源（PERIOD）：上課認列收入、單堂、分帳成本、次數包消耗。docs/finance-v2/02 §3.2、§3.4。
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { computeSplit } from "@/domains/finance/split";
import type { Allocation, ResolvedLine } from "@/domains/finance/types";
import { toCents } from "../money";
import type { DesiredLine } from "../lines";
import type { PeriodInput, PostResult, PostingContext } from "./types";

export type PeriodSplitResult = {
  /** 全部已認列收入（分）。 */
  incomeAll: number;
  /** 其中學生已付款的（分）。 */
  incomePaid: number;
  /** teacherId → { total, eligible }（分）：total 記費用，eligible 可發，其餘待學生付款。 */
  teachers: Map<number, { total: number; eligible: number }>;
  /** 場地費（分）：次數包或應付場地。 */
  venues: { venueId: number; packId?: number; amount: number }[];
  allocationsAll: Allocation[] | null;
};

/** 把規則裡的 venuePack 行換成這堂實際用掉的包（沒有包 → 0 元，跟 feat/finance 一樣）。 */
function resolveLines(period: PeriodInput): ResolvedLine[] {
  if (!period.rule) return [];
  return period.rule.lines.map((line) => {
    if (line.kind !== "venuePack") return line;
    if (!period.pack || period.pack.venueId !== line.venueId) {
      return { kind: "fixed", amount: 0, to: { type: "venue", venueId: line.venueId } };
    }
    return { kind: "fixed", amount: period.pack.unit, to: { type: "venue", venueId: line.venueId, packId: period.pack.packId } };
  });
}

/** 分帳：全部收入算一次（記費用），只算已付款的再算一次（老師可發）。 */
export function splitPeriod(period: PeriodInput): PeriodSplitResult {
  const incomeAll =
    period.usages.reduce((s, u) => s + u.value, 0) + period.dropIns.reduce((s, d) => s + toCents(d.amount), 0);
  const incomePaid =
    period.usages.filter((u) => u.paid).reduce((s, u) => s + u.value, 0) +
    period.dropIns.filter((d) => d.isPaid).reduce((s, d) => s + toCents(d.amount), 0);

  const teachers = new Map<number, { total: number; eligible: number }>();
  const venues: PeriodSplitResult["venues"] = [];
  if (!period.rule) return { incomeAll, incomePaid, teachers, venues, allocationsAll: null };

  const lines = resolveLines(period);
  const all = computeSplit(incomeAll / 100, lines, period.rule.rest, period.rule.fundLocationId);
  const paid = computeSplit(incomePaid / 100, lines, period.rule.rest, period.rule.fundLocationId);

  const teacherSum = (allocs: Allocation[]) => {
    const m = new Map<number, number>();
    for (const a of allocs) {
      if (a.payee.type !== "teacher") continue;
      m.set(a.payee.teacherId, (m.get(a.payee.teacherId) ?? 0) + a.amount);
    }
    return m;
  };
  const tAll = teacherSum(all);
  const tPaid = teacherSum(paid);
  for (const [teacherId, amt] of tAll) {
    const total = toCents(amt);
    const eligible = Math.min(total, Math.max(0, toCents(tPaid.get(teacherId) ?? 0)));
    if (total !== 0) teachers.set(teacherId, { total, eligible });
  }
  for (const a of all) {
    if (a.payee.type !== "venue") continue;
    const amount = toCents(a.amount);
    if (amount === 0) continue;
    venues.push({ venueId: a.payee.venueId, ...(a.payee.packId !== undefined ? { packId: a.payee.packId } : {}), amount });
  }
  return { incomeAll, incomePaid, teachers, venues, allocationsAll: all };
}

export function postPeriod(period: PeriodInput, ctx: PostingContext): PostResult {
  const lines: DesiredLine[] = [];
  const errors: string[] = [];
  const date = toTaipeiDateKey(period.startTime);
  if (date < ctx.conversionDate) return { lines, errors };

  const fund =
    period.fundLocationId !== null && ctx.locationExists(period.fundLocationId)
      ? period.fundLocationId
      : ctx.defaultLocationId;
  if (fund === null) return { lines, errors: ["NO_LOCATION"] };
  const lp = period.id;

  // 收入：用卡（含綁課卡缺席）
  for (const u of period.usages) {
    if (u.value === 0) continue;
    const party = { type: "STUDENT_CARD" as const, id: u.cardId };
    lines.push({ date, account: { key: "DEFERRED_REVENUE" }, locationId: u.cardLocationId, amount: u.value, party, lessonPeriodId: lp });
    lines.push({ date, account: { key: "REVENUE_LESSON" }, locationId: fund, amount: -u.value, lessonPeriodId: lp });
  }

  // 收入：單堂（先記應收，付款另記）
  for (const d of period.dropIns) {
    const amt = toCents(d.amount);
    if (amt === 0) continue;
    const party = { type: "DROP_IN" as const, id: d.id };
    lines.push({ date, account: { key: "AR" }, locationId: fund, amount: amt, party, lessonPeriodId: lp });
    lines.push({ date, account: { key: "REVENUE_DROPIN" }, locationId: fund, amount: -amt, lessonPeriodId: lp });
    if (d.isPaid) {
      const payDate = toTaipeiDateKey(d.paidAt ?? d.createdAt);
      const holder = d.paidByUserId ?? ctx.legacyHolderUserId;
      const ma = holder !== null ? ctx.moneyAccountOf(holder) : null;
      if (!ma) errors.push("NO_MONEY_ACCOUNT");
      else {
        // 收款日早於上課日（先付）也記在上課日：單堂的應收在上課日才成立。
        const d2 = payDate > date ? payDate : date;
        lines.push({ date: d2, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: amt, party, lessonPeriodId: lp });
        lines.push({ date: d2, account: { key: "AR" }, locationId: fund, amount: -amt, party, lessonPeriodId: lp });
      }
    }
  }

  // 分帳成本
  const split = splitPeriod(period);
  for (const [teacherId, { total, eligible }] of split.teachers) {
    const party = { type: "TEACHER" as const, id: teacherId };
    lines.push({ date, account: { key: "EXPENSE_TEACHER" }, locationId: fund, amount: total, party, lessonPeriodId: lp });
    if (eligible !== 0) {
      lines.push({ date, account: { key: "TEACHER_PAYABLE" }, locationId: fund, amount: -eligible, party, lessonPeriodId: lp });
    }
    if (total - eligible !== 0) {
      lines.push({ date, account: { key: "TEACHER_PAYABLE_HELD" }, locationId: fund, amount: -(total - eligible), party, lessonPeriodId: lp });
    }
  }
  for (const v of split.venues) {
    const party = { type: "VENUE" as const, id: v.venueId };
    const ma = v.packId !== undefined ? ctx.packMoneyAccountOf(v.packId) : null;
    if (v.packId !== undefined && !ma) {
      errors.push("NO_MONEY_ACCOUNT");
      continue;
    }
    lines.push({ date, account: { key: "EXPENSE_VENUE" }, locationId: fund, amount: v.amount, party, lessonPeriodId: lp });
    if (ma) {
      lines.push({ date, account: { key: "PREPAID_VENUE" }, locationId: ma.locationId, amount: -v.amount, party, lessonPeriodId: lp });
    } else {
      lines.push({ date, account: { key: "VENUE_PAYABLE" }, locationId: fund, amount: -v.amount, party, lessonPeriodId: lp });
    }
  }

  return { lines, errors };
}
