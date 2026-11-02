import { describe, it, expect } from "vitest";
import { computeSplit } from "./split";
import { splitRuleSchema } from "./types";
import type { ResolvedLine, RestTarget } from "./types";

const DINGDING = 1, CHARLENE = 2, SEAN = 3, PARTNER = 4;
const TAINAN = 10, KAOHSIUNG = 20, VENUE = 7;

const tainanLines: ResolvedLine[] = [
  { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: DINGDING } },
  { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: CHARLENE } },
  { kind: "fixed", amount: 300, to: { type: "venue", venueId: VENUE } },
];
const tainanRest: RestTarget = { type: "fund", locationId: TAINAN };

const kaoLines: ResolvedLine[] = [
  { kind: "fixed", amount: 405, to: { type: "venue", venueId: VENUE } },
  { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: KAOHSIUNG } },
];
const kaoRest: RestTarget = {
  type: "teachers",
  shares: [{ teacherId: SEAN, weight: 1 }, { teacherId: PARTNER, weight: 1 }],
};

const amounts = (r: { amount: number }[]) => r.map((a) => a.amount);
const sum = (r: { amount: number }[]) => r.reduce((s, a) => s + a.amount, 0);

function expectAmounts(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((x, i) => expect(actual[i]).toBeCloseTo(x, 2));
}

describe("computeSplit", () => {
  it("tainan rule (case 1)", () => {
    const r = computeSplit(666.67, tainanLines, tainanRest, TAINAN);
    expectAmounts(amounts(r), [222.22, 222.22, 300, -77.78]);
    expect(r[3]).toMatchObject({ payee: { type: "fund", locationId: TAINAN }, source: "deficit" });
    expect(sum(r)).toBeCloseTo(666.67, 2);
  });

  it("kaohsiung rule (case 2)", () => {
    const r = computeSplit(2350, kaoLines, kaoRest, KAOHSIUNG);
    expectAmounts(amounts(r), [405, 194.5, 875.25, 875.25]);
    expect(sum(r)).toBeCloseTo(2350, 2);
  });

  it("deficit absorbed by fund, teachers floor at 0 (case 3)", () => {
    const r = computeSplit(333.33, kaoLines, kaoRest, KAOHSIUNG);
    expectAmounts(amounts(r), [405, 0, 0, 0, -71.67]);
    expect(r[4]).toMatchObject({ payee: { type: "fund", locationId: KAOHSIUNG }, source: "deficit" });
    expect(r[2].source).toBe("rest");
    expect(sum(r)).toBeCloseTo(333.33, 2);
  });

  it("bound class (case 6)", () => {
    const r = computeSplit(3650, tainanLines, tainanRest, TAINAN);
    expectAmounts(amounts(r), [1216.67, 1216.67, 300, 916.67]);
    expect(sum(r)).toBeCloseTo(3650, 2);
  });

  it("zero income", () => {
    const r = computeSplit(0, tainanLines, tainanRest, TAINAN);
    expectAmounts(amounts(r), [0, 0, 300, -300]);
    expect(sum(r)).toBeCloseTo(0, 2);
  });

  it("sum always equals income", () => {
    const cases: [number, ResolvedLine[], RestTarget, number][] = [
      [666.67, tainanLines, tainanRest, TAINAN],
      [2350, kaoLines, kaoRest, KAOHSIUNG],
      [333.33, kaoLines, kaoRest, KAOHSIUNG],
      [3650, tainanLines, tainanRest, TAINAN],
      [0, tainanLines, tainanRest, TAINAN],
    ];
    for (const [inc, l, r, f] of cases) {
      expect(sum(computeSplit(inc, l, r, f))).toBeCloseTo(inc, 2);
    }
  });
});

describe("splitRuleSchema", () => {
  const ok = { lines: kaoLines, rest: kaoRest, fundLocationId: KAOHSIUNG };
  it("accepts a valid rule", () => {
    expect(splitRuleSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects bad pct, negative amount, zero weight, empty shares", () => {
    const bad = (p: unknown) => splitRuleSchema.safeParse(p).success;
    expect(bad({ ...ok, lines: [{ kind: "percent", pct: 101, base: "income", to: { type: "fund", locationId: 1 } }] })).toBe(false);
    expect(bad({ ...ok, lines: [{ kind: "fixed", amount: -1, to: { type: "fund", locationId: 1 } }] })).toBe(false);
    expect(bad({ ...ok, rest: { type: "teachers", shares: [{ teacherId: 1, weight: 0 }] } })).toBe(false);
    expect(bad({ ...ok, rest: { type: "teachers", shares: [] } })).toBe(false);
  });
});
