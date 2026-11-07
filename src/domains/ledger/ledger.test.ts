import { describe, expect, it } from "vitest";
import { sessionSliceValue, splitEvenly, toCents } from "./money";
import {
  aggregateLines,
  applyLockDate,
  balanceByBranch,
  diffLines,
  groupByDate,
  hashLines,
  unbalanced,
  type DesiredLine,
} from "./lines";
import { SYSTEM_ACCOUNTS, accountRefKey, parseAccountRefKey } from "./accounts";

const T = 1; // 台南
const K = 2; // 高雄
const D = "2026-11-12";

describe("money", () => {
  it("toCents rounds to the cent", () => {
    expect(toCents(333.333)).toBe(33333);
    expect(toCents(2000)).toBe(200000);
  });

  it("splitEvenly: last part absorbs the remainder, sum is exact", () => {
    expect(splitEvenly(200000, 6)).toEqual([33333, 33333, 33333, 33333, 33333, 33335]);
    expect(splitEvenly(405000, 10).every((p) => p === 40500)).toBe(true);
    for (const [total, n] of [[200000, 6], [170000, 6], [50000, 6], [1, 3], [0, 4], [99999, 7]]) {
      expect(splitEvenly(total, n).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("splitEvenly rejects non-integer cents", () => {
    expect(() => splitEvenly(10.5, 2)).toThrow();
    expect(() => splitEvenly(10, 0)).toThrow();
  });

  it("sessionSliceValue: a card's slices add up to its price", () => {
    expect(sessionSliceValue(2000, 6, 0, 1)).toBe(33333);
    expect(sessionSliceValue(2000, 6, 5, 1)).toBe(33335);
    expect(sessionSliceValue(2000, 6, 4, 2)).toBe(66668); // 一堂扣 2 格，跨到最後一格
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += sessionSliceValue(2000, 6, i, 1);
    expect(sum).toBe(200000);
    expect(sessionSliceValue(0, 1, 0, 1)).toBe(0); // 贈送卡
    expect(sessionSliceValue(2000, 6, 6, 1)).toBe(0); // 超過格數
  });
});

describe("accounts", () => {
  it("system keys and codes are unique", () => {
    expect(new Set(SYSTEM_ACCOUNTS.map((a) => a.key)).size).toBe(SYSTEM_ACCOUNTS.length);
    expect(new Set(SYSTEM_ACCOUNTS.map((a) => a.code)).size).toBe(SYSTEM_ACCOUNTS.length);
  });

  it("account ref keys round-trip", () => {
    for (const ref of [{ key: "AR" as const }, { moneyAccountId: 7 }, { accountId: 42 }]) {
      expect(parseAccountRefKey(accountRefKey(ref))).toEqual(ref);
    }
  });
});

// 案例 5（spec §13）：小明在台南把錢交給丁丁買卡，拿去上高雄的課。
const crossBranchUse: DesiredLine[] = [
  { date: D, account: { key: "DEFERRED_REVENUE" }, locationId: T, amount: 33333, party: { type: "STUDENT_CARD", id: 9 } },
  { date: D, account: { key: "REVENUE_LESSON" }, locationId: K, amount: -33333, lessonPeriodId: 100 },
];

describe("balanceByBranch", () => {
  it("adds a reciprocal interbranch pair when one entry spans two branches", () => {
    const out = balanceByBranch(crossBranchUse);
    expect(unbalanced(out)).toEqual([]);
    const ib = out.filter((l) => "key" in l.account && l.account.key === "INTERBRANCH");
    expect(ib).toEqual([
      { date: D, account: { key: "INTERBRANCH" }, locationId: T, amount: -33333, party: { type: "LOCATION", id: K } },
      { date: D, account: { key: "INTERBRANCH" }, locationId: K, amount: 33333, party: { type: "LOCATION", id: T } },
    ]);
    // 全教室往來合計 = 0
    expect(ib.reduce((a, l) => a + l.amount, 0)).toBe(0);
  });

  it("leaves a single-branch entry alone", () => {
    const lines: DesiredLine[] = [
      { date: D, account: { moneyAccountId: 1 }, locationId: T, amount: 200000 },
      { date: D, account: { key: "DEFERRED_REVENUE" }, locationId: T, amount: -200000 },
    ];
    expect(balanceByBranch(lines)).toEqual(lines);
  });

  it("pairs three branches greedily and balances each one", () => {
    const lines: DesiredLine[] = [
      { date: D, account: { key: "DEFERRED_REVENUE" }, locationId: 1, amount: 500 },
      { date: D, account: { key: "REVENUE_LESSON" }, locationId: 2, amount: -300 },
      { date: D, account: { key: "REVENUE_LESSON" }, locationId: 3, amount: -200 },
    ];
    const out = balanceByBranch(lines);
    expect(unbalanced(out)).toEqual([]);
    expect(out.filter((l) => "key" in l.account && l.account.key === "INTERBRANCH")).toHaveLength(4);
  });

  it("balances each date separately", () => {
    const lines = [...crossBranchUse, ...crossBranchUse.map((l) => ({ ...l, date: "2026-11-13" }))];
    expect(unbalanced(balanceByBranch(lines))).toEqual([]);
  });

  it("throws when the entry itself is unbalanced", () => {
    expect(() => balanceByBranch([crossBranchUse[0]])).toThrow(/unbalanced/);
  });
});

describe("diffLines", () => {
  const posted = balanceByBranch(crossBranchUse);

  it("is empty when nothing changed (idempotent sync)", () => {
    expect(diffLines(posted, posted)).toEqual([]);
    expect(diffLines(aggregateLines([...posted]), posted)).toEqual([]);
  });

  it("returns only the change, and the change is itself balanced", () => {
    // 那堂課又多一位同一張卡分部的學生
    const desired = balanceByBranch(crossBranchUse.map((l) => ({ ...l, amount: l.amount * 2 })));
    const delta = diffLines(desired, posted);
    expect(unbalanced(delta)).toEqual([]);
    expect(aggregateLines([...posted, ...delta])).toEqual(aggregateLines(desired));
  });

  it("reverses everything when the source disappears", () => {
    const delta = diffLines([], posted);
    expect(aggregateLines([...posted, ...delta])).toEqual([]);
  });

  it("ignores memo differences", () => {
    expect(diffLines(posted.map((l) => ({ ...l, memo: "x" })), posted)).toEqual([]);
  });

  it("rejects fractional amounts", () => {
    expect(() => aggregateLines([{ ...crossBranchUse[0], amount: 0.5 }])).toThrow();
  });
});

describe("applyLockDate", () => {
  it("moves lines dated on/before the lock date to the next day and keeps them balanced", () => {
    const lines = balanceByBranch(crossBranchUse);
    const moved = applyLockDate(lines, "2026-11-30");
    expect(new Set(moved.map((l) => l.date))).toEqual(new Set(["2026-12-01"]));
    expect(unbalanced(moved)).toEqual([]);
  });

  it("leaves later lines and unlocked ledgers alone", () => {
    const lines = balanceByBranch(crossBranchUse);
    expect(applyLockDate(lines, "2026-11-11")).toEqual(lines);
    expect(applyLockDate(lines, null)).toBe(lines);
  });

  it("crosses month ends correctly", () => {
    expect(applyLockDate([{ ...crossBranchUse[0], date: "2026-02-10" }], "2026-02-28")[0].date).toBe("2026-03-01");
  });
});

describe("groupByDate / hashLines", () => {
  it("groups by date in order", () => {
    const lines = [...crossBranchUse.map((l) => ({ ...l, date: "2026-11-13" })), ...crossBranchUse];
    expect([...groupByDate(lines).keys()]).toEqual([D, "2026-11-13"]);
  });

  it("hash is stable under reordering and memo, and changes with amounts", () => {
    const a = balanceByBranch(crossBranchUse);
    expect(hashLines([...a].reverse())).toBe(hashLines(a));
    expect(hashLines(a.map((l) => ({ ...l, memo: "m" })))).toBe(hashLines(a));
    expect(hashLines(a.map((l) => ({ ...l, amount: l.amount * 2 })))).not.toBe(hashLines(a));
  });
});
