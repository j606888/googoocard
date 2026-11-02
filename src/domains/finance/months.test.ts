import { describe, it, expect } from "vitest";
import {
  assignMonth,
  earliestOpenMonth,
  expiryDeltas,
  expiryHistoryEntries,
  monthOf,
  nextMonth,
  periodDeltas,
  periodHistoryEntries,
} from "./months";
import type { PeriodState } from "./months";
import { computeSplit } from "./split";
import { computeCustody } from "./ledger";
import type { Keepers, LedgerInput } from "./ledger";
import type { IncomeSource } from "./income";
import type { Allocation, ResolvedLine, RestTarget } from "./types";

const DINGDING = 1, SEAN = 2;
const T_SEAN = 14, PARTNER = 15;
const KAOHSIUNG = 22;
const STEPS = 32, PACK = 41;
const GENERAL = 2000 / 6;

const kaoLines: ResolvedLine[] = [
  { kind: "fixed", amount: 405, to: { type: "venue", venueId: STEPS, packId: PACK } },
  { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: KAOHSIUNG } },
];
const kaoRest: RestTarget = {
  type: "teachers",
  shares: [{ teacherId: T_SEAN, weight: 1 }, { teacherId: PARTNER, weight: 1 }],
};

let ref = 0;
const src = (holderUserId: number, amount: number, kind: IncomeSource["kind"] = "card"): IncomeSource => ({
  kind, refId: ++ref, studentId: ref, amount, paid: true, holderUserId,
});
const total = (income: IncomeSource[]) => income.reduce((s, x) => s + x.amount, 0);
const kaoState = (income: IncomeSource[]): PeriodState => ({
  income,
  allocations: computeSplit(total(income), kaoLines, kaoRest, KAOHSIUNG),
});
const amountTo = (allocs: Allocation[], match: (a: Allocation) => boolean) =>
  allocs.filter(match).reduce((s, a) => s + a.amount, 0);

const keepers: Keepers = {
  teacherPayer: { [T_SEAN]: SEAN, [PARTNER]: SEAN },
  teacherUser: { [T_SEAN]: SEAN, [PARTNER]: null },
  fundKeeper: { [KAOHSIUNG]: SEAN },
  venueLandlord: { [STEPS]: null },
  packPayer: { [PACK]: SEAN },
  branchKeeperOfPeriod: () => SEAN,
};
const emptyInput = (periods: LedgerInput["periods"]): LedgerInput => ({
  periods, prepaid: [], expiries: [], expenses: [], packs: [], transfers: [], refunds: [], fundOpening: {}, roundings: [],
});

describe("months", () => {
  it("monthOf uses Taipei time", () => {
    expect(monthOf(new Date("2026-11-30T16:00:00Z"))).toBe("2026-12");
    expect(monthOf(new Date("2026-11-30T15:59:59Z"))).toBe("2026-11");
  });

  it("earliestOpenMonth skips locked months from launch", () => {
    expect(earliestOpenMonth("2026-11", [])).toBe("2026-11");
    expect(earliestOpenMonth("2026-11", ["2026-11", "2026-12"])).toBe("2027-01");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });

  it("assignMonth: locked → open month; open → own month; later month → own month", () => {
    const locked = new Set(["2026-11"]);
    expect(assignMonth("2026-11", locked, "2026-12")).toBe("2026-12");
    expect(assignMonth("2026-12", locked, "2026-12")).toBe("2026-12");
    expect(assignMonth("2027-01", locked, "2026-12")).toBe("2027-01");
  });

  it("periodDeltas: case 8 (L4 +333.33 → fund +33.33, Sean +150, partner +150)", () => {
    const base = [src(SEAN, GENERAL), src(DINGDING, GENERAL), src(SEAN, 350, "dropIn")];
    const baseline = kaoState(base);
    const live = kaoState([...base, src(SEAN, GENERAL)]);
    const deltas = periodDeltas(new Map([[4, live.allocations!]]), new Map([[4, baseline.allocations!]]));
    const d = deltas.get(4)!;
    expect(d).toHaveLength(3); // 場地 405 沒變 → 不列
    expect(amountTo(d, (a) => a.payee.type === "fund")).toBeCloseTo(33.33, 2);
    expect(amountTo(d, (a) => a.payee.type === "teacher" && a.payee.teacherId === T_SEAN)).toBeCloseTo(150, 2);
    expect(amountTo(d, (a) => a.payee.type === "teacher" && a.payee.teacherId === PARTNER)).toBeCloseTo(150, 2);
  });

  it("periodDeltas: unchanged → no entry; removed period → negative baseline", () => {
    const state = kaoState([src(SEAN, GENERAL), src(SEAN, GENERAL), src(SEAN, GENERAL), src(SEAN, GENERAL)]);
    expect(periodDeltas(new Map([[1, state.allocations!]]), new Map([[1, state.allocations!]])).size).toBe(0);
    const removed = periodDeltas(new Map(), new Map([[1, state.allocations!]])).get(1)!;
    expect(amountTo(removed, () => true)).toBeCloseTo(-total(state.income), 5);
  });
});

describe("periodHistoryEntries → computeCustody", () => {
  it("unchanged locked period → one entry in its locked month", () => {
    const s = kaoState([src(SEAN, GENERAL)]);
    const entries = periodHistoryEntries(4, [
      { month: "2026-11", state: s },
      { month: "2026-12", state: s },
    ]);
    expect(entries.map((e) => e.month)).toEqual(["2026-11"]);
  });

  it("delta with new income held by someone else (case 8 with the other custodian's card)", () => {
    const base = [src(SEAN, GENERAL), src(DINGDING, GENERAL), src(SEAN, 350, "dropIn")];
    const baseline = kaoState(base);
    const live = kaoState([...base, src(DINGDING, GENERAL)]);
    const entries = periodHistoryEntries(4, [
      { month: "2026-11", state: baseline },
      { month: "2026-12", state: live },
    ]);
    expect(new Set(entries.map((e) => e.month))).toEqual(new Set(["2026-11", "2026-12"]));

    const nov = computeCustody(emptyInput(entries), keepers, { through: "2026-11" });
    const all = computeCustody(emptyInput(entries), keepers);
    const fresh = computeCustody(emptyInput([{ periodId: 4, month: "2026-12", income: live.income, allocations: live.allocations }]), keepers);
    // 十一月不變；全部 = 直接用現況算
    expect(nov[DINGDING].peers[SEAN]).toBeCloseTo(GENERAL, 5);
    expect(all[DINGDING].peers[SEAN]).toBeCloseTo(GENERAL * 2, 5);
    expect(all[DINGDING].cash).toBeCloseTo(GENERAL * 2, 5);
    expect(all[SEAN].self).toBeCloseTo(fresh[SEAN].self, 5);
    expect(all[SEAN].teachers[PARTNER]).toBeCloseTo(fresh[SEAN].teachers[PARTNER], 5);
    expect(all[SEAN].funds[KAOHSIUNG]).toBeCloseTo(fresh[SEAN].funds[KAOHSIUNG], 5);
    // 十二月的差額 = 案例 8：Sean +150、搭檔 +150、公積金 +33.33
    expect(all[SEAN].self - nov[SEAN].self).toBeCloseTo(150, 2);
    expect(all[SEAN].teachers[PARTNER] - nov[SEAN].teachers[PARTNER]).toBeCloseTo(150, 2);
  });

  it("delta without new income (rule edit) goes to the baseline holders pro-rata", () => {
    const income = [src(SEAN, 600), src(DINGDING, 400)];
    const baseline = kaoState(income);
    // 改規則：剩下的全給 Sean
    const liveAllocs = computeSplit(1000, kaoLines, { type: "teachers", shares: [{ teacherId: T_SEAN, weight: 1 }] }, KAOHSIUNG);
    const entries = periodHistoryEntries(4, [
      { month: "2026-11", state: baseline },
      { month: "2026-12", state: { income, allocations: liveAllocs } },
    ]);
    const nov = computeCustody(emptyInput(entries), keepers, { through: "2026-11" });
    const all = computeCustody(emptyInput(entries), keepers);
    const partnerBefore = nov[SEAN].teachers[PARTNER];
    expect(partnerBefore).toBeGreaterThan(0);
    // 搭檔那份移給 Sean；現金不變；丁丁的 40% 份照比例 → 欠 Sean 不變（全由 Sean 負責付）
    expect(all[SEAN].teachers[PARTNER]).toBeCloseTo(0, 5);
    expect(all[SEAN].self - nov[SEAN].self).toBeCloseTo(partnerBefore, 5);
    expect(all[SEAN].cash).toBeCloseTo(nov[SEAN].cash, 5);
    expect(all[DINGDING].cash).toBeCloseTo(nov[DINGDING].cash, 5);
    expect(all[DINGDING].peers[SEAN]).toBeCloseTo(400, 5);
  });

  it("period that disappears after lock (attendance undone) reverses in the open month", () => {
    const baseline = kaoState([src(DINGDING, GENERAL)]);
    const entries = periodHistoryEntries(4, [
      { month: "2026-11", state: baseline },
      { month: "2026-12", state: { income: [], allocations: [] } },
    ]);
    const all = computeCustody(emptyInput(entries), keepers);
    expect(all[DINGDING].cash).toBeCloseTo(0, 5);
    expect(all[DINGDING].peers[SEAN] ?? 0).toBeCloseTo(0, 5);
    expect(all[SEAN].self).toBeCloseTo(0, 5);
  });

  it("expiryHistoryEntries: snapshot value stays in its month, later change is reversal + reapply in the open month", () => {
    const fund = { type: "fund" as const, locationId: KAOHSIUNG };
    const entries = expiryHistoryEntries(7, [
      { month: "2026-11", state: { value: 300, holderUserId: DINGDING, to: fund } },
      { month: "2026-12", state: { value: 400, holderUserId: DINGDING, to: fund } },
    ]);
    expect(entries.map((e) => [e.month, e.value])).toEqual([["2026-11", 300], ["2026-12", -300], ["2026-12", 400]]);
    // 沒變 → 只有第一版；現況變 0 → 只沖銷
    expect(expiryHistoryEntries(7, [
      { month: "2026-11", state: { value: 300, holderUserId: DINGDING, to: fund } },
      { month: "2026-12", state: { value: 300, holderUserId: DINGDING, to: fund } },
    ])).toHaveLength(1);
    expect(expiryHistoryEntries(7, [
      { month: "2026-11", state: { value: 300, holderUserId: DINGDING, to: fund } },
      { month: "2026-12", state: { value: 0, holderUserId: DINGDING, to: fund } },
    ]).map((e) => e.value)).toEqual([300, -300]);
    expect(expiryDeltas(
      { value: 400, holderUserId: DINGDING, to: { type: "user", userId: SEAN } },
      { value: 300, holderUserId: DINGDING, to: fund },
    )).toEqual([{ to: { type: "user", userId: SEAN }, amount: 400 }, { to: fund, amount: -300 }]);
  });
});
