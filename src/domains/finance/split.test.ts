import { describe, it, expect } from "vitest";
import { computeSplit } from "./split";
import { EMPTY_RULE, splitRuleSchema } from "./types";
import type { ResolvedLine, RestTarget } from "./types";

const DINGDING = 1, CHARLENE = 2, SEAN = 3, PARTNER = 4;
const TAINAN = 10, VENUE = 7;

const amounts = (r: { amount: number }[]) => r.map((a) => a.amount);
const sum = (r: { amount: number }[]) => r.reduce((s, a) => s + a.amount, 0);

function expectAmounts(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((x, i) => expect(actual[i]).toBeCloseTo(x, 2));
}

// 台南：兩位老師各 1/3、場地 300，剩下進公積金（v2 的 case 1、6）
const tainanLines: ResolvedLine[] = [
  { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: DINGDING } },
  { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: CHARLENE } },
  { kind: "fixed", amount: 300, to: { type: "venue", venueId: VENUE } },
];
const tainanRest: RestTarget = { type: "fund", locationId: TAINAN };

// 高雄：場地 405、剩下的 10% 進開課分部、其餘兩位老師平分（v2 的 case 2、3）
const kaoLines: ResolvedLine[] = [
  { kind: "fixed", amount: 405, to: { type: "venue", venueId: VENUE } },
  { kind: "percent", pct: 10, base: "remaining", to: { type: "lessonFund" } },
];
const kaoRest: RestTarget = {
  type: "teachers",
  shares: [{ teacherId: SEAN, weight: 1 }, { teacherId: PARTNER, weight: 1 }],
};

// 規格書 §4 的例子：外師 1000、10% 進開課分部、剩下給卡錢的分部
const specLines: ResolvedLine[] = [
  { kind: "fixed", amount: 1000, to: { type: "teacher", teacherId: PARTNER } },
  { kind: "percent", pct: 10, base: "income", to: { type: "lessonFund" } },
];

describe("computeSplit", () => {
  it("規格書例子：1800 → 外師 1000、公積金 180、剩下 620 給卡錢分部", () => {
    const r = computeSplit(1800, specLines, { type: "holder" });
    expectAmounts(amounts(r), [1000, 180, 620]);
    expect(r[2]).toMatchObject({ payee: { type: "holder" }, source: "rest" });
  });

  it("holder 不夠付時差額也記給 holder", () => {
    const r = computeSplit(900, specLines, { type: "holder" });
    expectAmounts(amounts(r), [1000, 90, -190]);
    expect(r[2]).toMatchObject({ payee: { type: "holder" }, source: "deficit" });
  });

  it("台南規則（收入不夠，差額進公積金）", () => {
    const r = computeSplit(666.67, tainanLines, tainanRest);
    expectAmounts(amounts(r), [222.22, 222.22, 300, -77.78]);
    expect(r[3]).toMatchObject({ payee: { type: "fund", locationId: TAINAN }, source: "deficit" });
  });

  it("高雄規則（剩下的老師平分）", () => {
    const r = computeSplit(2350, kaoLines, kaoRest);
    expectAmounts(amounts(r), [405, 194.5, 875.25, 875.25]);
  });

  it("老師最少 0，差額進開課分部", () => {
    const r = computeSplit(333.33, kaoLines, kaoRest);
    expectAmounts(amounts(r), [405, 0, 0, 0, -71.67]);
    expect(r[4]).toMatchObject({ payee: { type: "lessonFund" }, source: "deficit" });
  });

  it("沒有任何行：全部給卡錢分部", () => {
    const r = computeSplit(1200, [], EMPTY_RULE.rest);
    expectAmounts(amounts(r), [1200]);
  });

  it("加總永遠等於收入", () => {
    const cases: [number, ResolvedLine[], RestTarget][] = [
      [1800, specLines, { type: "holder" }],
      [900, specLines, { type: "holder" }],
      [666.67, tainanLines, tainanRest],
      [2350, kaoLines, kaoRest],
      [333.33, kaoLines, kaoRest],
      [0, tainanLines, { type: "lessonFund" }],
    ];
    for (const [inc, l, r] of cases) expect(sum(computeSplit(inc, l, r))).toBeCloseTo(inc, 2);
  });
});

describe("splitRuleSchema", () => {
  const ok = { lines: kaoLines, rest: kaoRest };
  const valid = (p: unknown) => splitRuleSchema.safeParse(p).success;
  it("接受合法規則", () => {
    expect(valid(ok)).toBe(true);
    expect(valid(EMPTY_RULE)).toBe(true);
  });
  it("擋掉壞資料", () => {
    expect(valid({ ...ok, lines: [{ kind: "percent", pct: 101, base: "income", to: { type: "lessonFund" } }] })).toBe(false);
    expect(valid({ ...ok, lines: [{ kind: "fixed", amount: -1, to: { type: "lessonFund" } }] })).toBe(false);
    expect(valid({ ...ok, lines: [{ kind: "fixed", amount: 1, to: { type: "holder" } }] })).toBe(false);
    expect(valid({ ...ok, rest: { type: "teachers", shares: [{ teacherId: 1, weight: 0 }] } })).toBe(false);
    expect(valid({ ...ok, rest: { type: "teachers", shares: [] } })).toBe(false);
  });
});
