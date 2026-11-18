import { describe, it, expect } from "vitest";
import { computeSplit } from "./split";
import { branchIncome, netPairs, periodFlows } from "./flows";
import type { ResolvedLine } from "./types";

const T = 1, K = 2, OUTSIDE = 9, VENUE = 7;

const specLines: ResolvedLine[] = [
  { kind: "fixed", amount: 1000, to: { type: "teacher", teacherId: OUTSIDE } },
  { kind: "percent", pct: 10, base: "income", to: { type: "lessonFund" } },
];

function run(piles: { locationId: number; income: number }[], lines: ResolvedLine[], payer = T, extra = {}) {
  const income = piles.reduce((s, p) => s + p.income, 0);
  const allocations = computeSplit(income, lines, { type: "holder" });
  const input = { income, piles, allocations, lessonLocationId: T, payerLocationId: payer, ...extra };
  return { flows: periodFlows(input), branch: branchIncome(input) };
}

describe("periodFlows", () => {
  it("規格書例子：高雄欠台南 500（外師）＋ 90（公積金）", () => {
    const { flows, branch } = run([{ locationId: T, income: 900 }, { locationId: K, income: 900 }], specLines);
    expect(flows).toEqual(
      expect.arrayContaining([
        { from: K, to: T, amount: 500, reason: "teacher" },
        { from: K, to: T, amount: 90, reason: "fund" },
      ])
    );
    expect(flows).toHaveLength(2);
    expect(branch).toEqual(expect.arrayContaining([{ locationId: T, amount: 490 }, { locationId: K, amount: 310 }]));
  });

  it("Sean 在台南付外師：台南欠高雄外師那份，高雄仍欠台南公積金", () => {
    const { flows } = run([{ locationId: T, income: 900 }, { locationId: K, income: 900 }], specLines, K);
    expect(flows).toEqual(
      expect.arrayContaining([
        { from: T, to: K, amount: 500, reason: "teacher" },
        { from: K, to: T, amount: 90, reason: "fund" },
      ])
    );
    expect(netPairs(flows)).toEqual([{ from: T, to: K, amount: 410 }]);
  });

  it("全部是台南的卡：沒有任何往來", () => {
    const { flows } = run([{ locationId: T, income: 1800 }], specLines);
    expect(flows).toEqual([]);
  });

  it("全部是高雄的舊卡：高雄負擔全部成本與公積金", () => {
    const { flows, branch } = run([{ locationId: K, income: 1800 }], specLines);
    expect(netPairs(flows)).toEqual([{ from: K, to: T, amount: 1180 }]);
    expect(branch).toEqual(expect.arrayContaining([{ locationId: T, amount: 180 }, { locationId: K, amount: 620 }]));
  });

  it("次數包場地費欠買包的分部", () => {
    const lines: ResolvedLine[] = [{ kind: "fixed", amount: 400, to: { type: "venue", venueId: VENUE, packId: 5 } }];
    const { flows } = run([{ locationId: T, income: 500 }, { locationId: K, income: 500 }], lines, T, {
      packLocationId: () => K,
    });
    expect(flows).toEqual([{ from: T, to: K, amount: 200, reason: "venue" }]);
  });

  it("收入是 0：成本全部算開課分部，沒有往來", () => {
    const { flows } = run([], specLines);
    expect(flows).toEqual([]);
  });
});

describe("netPairs", () => {
  it("互相抵銷", () => {
    expect(
      netPairs([
        { from: K, to: T, amount: 590 },
        { from: T, to: K, amount: 100 },
      ])
    ).toEqual([{ from: K, to: T, amount: 490 }]);
  });
  it("剛好抵平就不列", () => {
    expect(netPairs([{ from: K, to: T, amount: 10 }, { from: T, to: K, amount: 10 }])).toEqual([]);
  });
});
