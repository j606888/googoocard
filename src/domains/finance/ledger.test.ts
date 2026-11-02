import { describe, it, expect } from "vitest";
import { computeCustody, assertCustodyInvariants } from "./ledger";
import type { Buckets, Keepers, LedgerInput } from "./ledger";
import { computeSplit } from "./split";
import type { IncomeSource } from "./income";
import type { ResolvedLine, RestTarget } from "./types";

// spec §14：十一月模擬。人用 id。
const DINGDING = 1, SEAN = 2;
const CHARLENE = 11, NORA = 12, T_DINGDING = 13, T_SEAN = 14, PARTNER = 15;
const TAINAN = 21, KAOHSIUNG = 22;
const HOME = 31, STEPS = 32, PACK = 41;

const GENERAL = 2000 / 6; // 333.33
const BOUND = 2000 / 5; // 400

let ref = 0;
const card = (holderUserId: number, amount = GENERAL): IncomeSource => ({
  kind: "card", refId: ++ref, studentId: ref, amount, paid: true, holderUserId,
});
const absence = (holderUserId: number, amount: number): IncomeSource => ({
  kind: "absence", refId: ++ref, studentId: ref, amount, paid: true, holderUserId,
});
const dropIn = (holderUserId: number, amount: number): IncomeSource => ({
  kind: "dropIn", refId: ++ref, studentId: ref, amount, paid: true, holderUserId,
});
const unpaid = (amount: number): IncomeSource => ({
  kind: "card", refId: ++ref, studentId: ref, amount, paid: false, holderUserId: null,
});

const third = 100 / 3;
const tainanLines = (partner: number): ResolvedLine[] => [
  { kind: "percent", pct: third, base: "income", to: { type: "teacher", teacherId: T_DINGDING } },
  { kind: "percent", pct: third, base: "income", to: { type: "teacher", teacherId: partner } },
  { kind: "fixed", amount: 300, to: { type: "venue", venueId: HOME } },
];
const tainanRest: RestTarget = { type: "fund", locationId: TAINAN };
const sundayLines: ResolvedLine[] = [
  { kind: "fixed", amount: 300, to: { type: "venue", venueId: HOME } },
  { kind: "percent", pct: 0, base: "remaining", to: { type: "fund", locationId: TAINAN } },
];
const sundayRest: RestTarget = { type: "teachers", shares: [{ teacherId: T_SEAN, weight: 1 }] };
const kaoLines: ResolvedLine[] = [
  { kind: "fixed", amount: 405, to: { type: "venue", venueId: STEPS, packId: PACK } },
  { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: KAOHSIUNG } },
];
const kaoRest: RestTarget = {
  type: "teachers",
  shares: [{ teacherId: T_SEAN, weight: 1 }, { teacherId: PARTNER, weight: 1 }],
};

function period(
  periodId: number,
  income: IncomeSource[],
  lines: ResolvedLine[],
  rest: RestTarget,
  fund: number,
  month = "2026-11",
): LedgerInput["periods"][number] {
  const total = income.filter((s) => s.paid).reduce((s, x) => s + x.amount, 0);
  return { periodId, month, income, allocations: computeSplit(total, lines, rest, fund) };
}

const keepers: Keepers = {
  teacherPayer: { [CHARLENE]: DINGDING, [NORA]: DINGDING, [T_DINGDING]: DINGDING, [T_SEAN]: SEAN, [PARTNER]: SEAN },
  teacherUser: { [CHARLENE]: null, [NORA]: null, [T_DINGDING]: DINGDING, [T_SEAN]: SEAN, [PARTNER]: null },
  fundKeeper: { [TAINAN]: DINGDING, [KAOHSIUNG]: SEAN },
  venueLandlord: { [HOME]: DINGDING, [STEPS]: null },
  packPayer: { [PACK]: SEAN },
  branchKeeperOfPeriod: (periodId) => (periodId === 4 ? SEAN : DINGDING),
};

function november(): LedgerInput {
  return {
    periods: [
      period(1, [card(DINGDING, BOUND), card(DINGDING, BOUND), dropIn(DINGDING, 450)], tainanLines(NORA), tainanRest, TAINAN),
      period(2, [card(DINGDING), card(DINGDING), card(DINGDING, 0)], sundayLines, sundayRest, TAINAN),
      period(3, [card(DINGDING), card(DINGDING), card(DINGDING)], tainanLines(CHARLENE), tainanRest, TAINAN),
      period(4, [card(SEAN), card(DINGDING), dropIn(SEAN, 350)], kaoLines, kaoRest, KAOHSIUNG),
      period(5, [card(DINGDING, BOUND), absence(DINGDING, BOUND)], tainanLines(NORA), tainanRest, TAINAN),
      period(6, [card(DINGDING), card(DINGDING), card(DINGDING), unpaid(GENERAL)], tainanLines(CHARLENE), tainanRest, TAINAN),
    ],
    prepaid: [
      { holderUserId: DINGDING, value: GENERAL * 2 }, // 小明
      { holderUserId: DINGDING, value: GENERAL * 3 }, // 小華
      { holderUserId: DINGDING, value: GENERAL * 4 }, // 小美
      { holderUserId: DINGDING, value: BOUND * 3 }, // B1
      { holderUserId: DINGDING, value: BOUND * 3 }, // B2
      { holderUserId: DINGDING, value: 0 }, // G2 贈送卡
      { holderUserId: SEAN, value: GENERAL * 5 }, // 小強
    ],
    expiries: [],
    expenses: [
      { amount: 500, locationId: TAINAN, paidByUserId: DINGDING, month: "2026-11" },
      { amount: 210, locationId: KAOHSIUNG, paidByUserId: SEAN, month: "2026-11" },
    ],
    packs: [{ packId: PACK, price: 4050, paidByUserId: SEAN }],
    transfers: [],
    refunds: [],
    fundOpening: { [TAINAN]: 0, [KAOHSIUNG]: 0 },
    roundings: [],
  };
}

function expectRecord(actual: Record<number, number>, expected: Record<number, number>, digits = 2) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const k of keys) {
    expect(actual[Number(k)] ?? 0, `key ${k}`).toBeCloseTo(expected[Number(k)] ?? 0, digits);
  }
}

describe("computeCustody — spec §14", () => {
  it("simulation 14.4 dingding", () => {
    const d = computeCustody(november(), keepers)[DINGDING];
    expect(d.cash).toBeCloseTo(9950, 2);
    expect(d.prepaid).toBeCloseTo(5400, 2);
    // spec 寫的是四捨五入後的加總（416.67+266.67、333.33+333.33）；精確值 683.33／666.67
    expectRecord(d.teachers, { [NORA]: 683.34, [CHARLENE]: 666.66 }, 1);
    expect(d.self).toBeCloseTo(2850, 2);
    expectRecord(d.funds, { [TAINAN]: -350 });
    expectRecord(d.peers, { [SEAN]: 700 });
    expectRecord(d.packs, {});
    expectRecord(d.venues, {});
    expect(d.unallocated).toBeCloseTo(0, 5);
  });

  it("simulation 14.4 sean", () => {
    const s = computeCustody(november(), keepers)[SEAN];
    expect(s.cash).toBeCloseTo(-1910, 0);
    expect(s.prepaid).toBeCloseTo(1666.67, 2);
    expect(s.self).toBeCloseTo(641.92, 2);
    expectRecord(s.teachers, { [PARTNER]: 275.25 });
    expectRecord(s.funds, { [KAOHSIUNG]: -148.83 });
    expectRecord(s.packs, { [PACK]: -3645 });
    expectRecord(s.peers, { [DINGDING]: -700 });
    expect(s.unallocated).toBeCloseTo(0, 5);
  });

  it("simulation 14.6 after transfers", () => {
    const input = november();
    const m = "2026-12";
    input.transfers = [
      { amount: 700, fromUserId: DINGDING, toKind: "USER", toUserId: SEAN, month: m },
      { amount: 683, fromUserId: DINGDING, toKind: "TEACHER", toTeacherId: NORA, month: m },
      { amount: 667, fromUserId: DINGDING, toKind: "TEACHER", toTeacherId: CHARLENE, month: m },
      { amount: 2850, fromUserId: DINGDING, toKind: "SELF", month: m },
      { amount: 275, fromUserId: SEAN, toKind: "TEACHER", toTeacherId: PARTNER, month: m },
      { amount: 642, fromUserId: SEAN, toKind: "SELF", month: m },
    ];
    const r = computeCustody(input, keepers);
    const d = r[DINGDING];
    const s = r[SEAN];

    expect(d.cash).toBeCloseTo(5050, 2);
    expect(d.prepaid).toBeCloseTo(5400, 2);
    expectRecord(d.funds, { [TAINAN]: -350 });
    expect(Math.abs(d.self)).toBeLessThan(0.005);

    expect(s.cash).toBeCloseTo(-2127, 0);
    expect(s.prepaid).toBeCloseTo(1666.67, 2);
    expectRecord(s.packs, { [PACK]: -3645 });
    expectRecord(s.funds, { [KAOHSIUNG]: -148.83 });
    // 取整零頭（進公積金是月結的動作，Task 13）
    expect(Math.abs(s.self)).toBeLessThan(1);

    for (const b of [d, s]) {
      for (const v of Object.values(b.teachers)) expect(Math.abs(v)).toBeLessThan(1);
      for (const v of Object.values(b.peers)) expect(Math.abs(v)).toBeLessThan(0.005);
    }
  });

  it("invariants hold", () => {
    const input = november();
    input.expiries = [
      {
        studentCardId: 99, date: new Date("2026-11-28T00:00:00+08:00"), value: 500,
        holderUserId: DINGDING, soldLocationId: KAOHSIUNG, to: { type: "user", userId: SEAN }, month: "2026-11",
      },
      {
        studentCardId: 98, date: new Date("2026-11-28T00:00:00+08:00"), value: 300,
        holderUserId: SEAN, soldLocationId: TAINAN, to: { type: "fund", locationId: TAINAN }, month: "2026-11",
      },
    ];
    input.expenses.push({ amount: 90, locationId: KAOHSIUNG, paidByUserId: DINGDING, month: "2026-11" });
    input.refunds = [{ amount: 100, paidByUserId: SEAN, holderUserId: DINGDING, month: "2026-11" }];
    input.roundings = [
      { userId: SEAN, locationId: KAOHSIUNG, bucket: "teacher", teacherId: PARTNER, amount: 0.25, month: "2026-11" },
      { userId: DINGDING, locationId: KAOHSIUNG, bucket: "self", amount: 0.4, month: "2026-11" },
    ];
    input.transfers = [{ amount: 700, fromUserId: DINGDING, toKind: "USER", toUserId: SEAN, month: "2026-11" }];
    const r = computeCustody(input, keepers);
    expect(() => assertCustodyInvariants(r)).not.toThrow();

    const sumOf = (b: Buckets) =>
      b.prepaid + b.unallocated + b.self +
      [b.teachers, b.funds, b.packs, b.venues, b.peers]
        .flatMap((x) => Object.values(x))
        .reduce((a, v) => a + v, 0);
    for (const b of Object.values(r)) expect(sumOf(b)).toBeCloseTo(b.cash, 2);
    expect(r[DINGDING].peers[SEAN]).toBeCloseTo(-r[SEAN].peers[DINGDING], 5);
    // 過期：丁丁手上的 500 歸 Sean 個人 → 丁丁欠 Sean；Sean 手上的 300 歸台南公積金（丁丁）
    expect(r[SEAN].self).toBeCloseTo(641.92 + 500, 2);
    expect(r[DINGDING].funds[TAINAN]).toBeCloseTo(-350 + 300, 2);
  });

  it("assertCustodyInvariants catches a broken ledger", () => {
    const r = computeCustody(november(), keepers);
    r[DINGDING].self += 1;
    expect(() => assertCustodyInvariants(r)).toThrow();
    const r2 = computeCustody(november(), keepers);
    r2[SEAN].peers[DINGDING] += 1;
    r2[SEAN].self -= 1;
    expect(() => assertCustodyInvariants(r2)).toThrow();
  });

  it("through excludes later months", () => {
    const base = computeCustody(november(), keepers);
    const input = november();
    input.periods.push(period(7, [card(DINGDING)], tainanLines(NORA), tainanRest, TAINAN, "2026-12"));
    input.expenses.push({ amount: 1000, locationId: TAINAN, paidByUserId: DINGDING, month: "2026-12" });
    input.transfers.push({ amount: 700, fromUserId: DINGDING, toKind: "USER", toUserId: SEAN, month: "2026-12" });

    const all = computeCustody(input, keepers);
    expect(all[DINGDING].cash).not.toBeCloseTo(base[DINGDING].cash, 0);

    const nov = computeCustody(input, keepers, { through: "2026-11" });
    for (const id of [DINGDING, SEAN]) {
      expect(nov[id].cash).toBeCloseTo(base[id].cash, 5);
      expect(nov[id].self).toBeCloseTo(base[id].self, 5);
      expectRecord(nov[id].peers, base[id].peers);
      expectRecord(nov[id].funds, base[id].funds);
    }
  });

  it("no rule → holder's unallocated; unresolved keeper → holder's unallocated", () => {
    const input = november();
    input.periods = [
      { periodId: 1, month: "2026-11", income: [card(SEAN, 300)], allocations: null },
      {
        periodId: 2, month: "2026-11", income: [card(DINGDING, 200)],
        allocations: [{ payee: { type: "teacher", teacherId: 777 }, amount: 200, source: "rest" }],
      },
    ];
    input.expenses = [];
    const r = computeCustody(input, keepers);
    expect(r[SEAN].unallocated).toBeCloseTo(300, 5);
    expect(r[DINGDING].unallocated).toBeCloseTo(200, 5);
  });

  it("refund paid by the card's own holder nets against the V−R expiry", () => {
    const before = november();
    before.prepaid.push({ holderUserId: DINGDING, value: 1000 }); // 還開著的卡
    const base = computeCustody(before, keepers)[DINGDING];

    const after = november(); // 退費後卡關閉，不在預收裡
    after.refunds = [{ amount: 400, paidByUserId: DINGDING, holderUserId: DINGDING, month: "2026-11" }];
    after.expiries = [
      {
        studentCardId: 97, date: new Date("2026-11-28T00:00:00+08:00"), value: 600,
        holderUserId: DINGDING, soldLocationId: TAINAN, to: { type: "fund", locationId: TAINAN }, month: "2026-11",
      },
    ];
    const r = computeCustody(after, keepers);
    expect(() => assertCustodyInvariants(r)).not.toThrow();
    const d = r[DINGDING];
    expect(d.cash).toBeCloseTo(base.cash - 400, 5);
    expect(d.prepaid).toBeCloseTo(base.prepaid - 1000, 5);
    expect(d.funds[TAINAN]).toBeCloseTo(base.funds[TAINAN] + 600, 5);
    expectRecord(d.peers, base.peers);
  });

  it("a slice with no holder is dropped together with its cash", () => {
    const input = november();
    const orphan: IncomeSource = { ...card(SEAN, 300), holderUserId: null };
    input.periods = [period(4, [card(SEAN, 300), orphan], kaoLines, kaoRest, KAOHSIUNG)];
    input.expenses = [];
    const r = computeCustody(input, keepers); // 不變式不 throw
    const s = r[SEAN];
    expect(s.cash - s.prepaid + 4050).toBeCloseTo(300, 5); // 只有自己那份現金
    // 分帳也只拿一半（600 的一半）
    expect(s.self + s.teachers[PARTNER] + s.funds[KAOHSIUNG] + (s.packs[PACK] + 4050)).toBeCloseTo(300, 5);
    expect(s.packs[PACK] + 4050).toBeCloseTo(405 / 2, 5);
  });

  it("external venue per-session goes to the branch keeper's venues bucket", () => {
    const input = november();
    input.periods = [
      {
        periodId: 4, month: "2026-11", income: [card(DINGDING, 500)],
        allocations: [
          { payee: { type: "venue", venueId: STEPS }, amount: 250, source: "line" },
          { payee: { type: "fund", locationId: KAOHSIUNG }, amount: 250, source: "rest" },
        ],
      },
    ];
    const r = computeCustody(input, keepers);
    expectRecord(r[SEAN].venues, { [STEPS]: 250 });
    expect(r[DINGDING].peers[SEAN]).toBeCloseTo(500, 5);
  });
});
