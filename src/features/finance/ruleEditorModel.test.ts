import { describe, expect, it } from "vitest";
import { rowsToRule, ruleToRows, hasVenuePack, validateRows, describeRow, remainingBeforeRow, shareText, previewSplit, newPercentRow, checkRule, deficitFundOf } from "./ruleEditorModel";
import type { RuleRow } from "./ruleEditorModel";
import type { SplitRule } from "@/domains/finance/types";

// 台南：兩位老師各 1/3（收入）→ 場地固定 → 剩下的進公積金
const tainan: SplitRule = {
  lines: [
    { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: 1 } },
    { kind: "percent", pct: 100 / 3, base: "income", to: { type: "teacher", teacherId: 2 } },
    { kind: "fixed", amount: 300, to: { type: "venue", venueId: 7 } },
  ],
  rest: { type: "fund", locationId: 5 },
  fundLocationId: 5,
};

// 高雄：場地次數包 → 助教 → 公積金 10%（剩下的）→ 剩下的平分
const kaohsiung: SplitRule = {
  lines: [
    { kind: "venuePack", venueId: 9 },
    { kind: "fixed", amount: 350, to: { type: "teacher", teacherId: 3 } },
    { kind: "percent", pct: 10, base: "remaining", to: { type: "fund", locationId: 6 } },
  ],
  rest: {
    type: "teachers",
    shares: [
      { teacherId: 4, weight: 1 },
      { teacherId: 5, weight: 1 },
    ],
  },
  fundLocationId: 6,
};

describe("rule editor model", () => {
  it.each([
    ["tainan", tainan],
    ["kaohsiung", kaohsiung],
  ])("round-trips %s", (_name, rule) => {
    expect(rowsToRule(ruleToRows(rule))).toEqual(rule);
  });

  it("always ends with the rest row", () => {
    const rows = ruleToRows(kaohsiung);
    expect(rows[rows.length - 1].type).toBe("rest");
    expect(hasVenuePack(rows)).toBe(true);
    expect(validateRows(rows)).toBeNull();
  });
});

describe("describeRow", () => {
  const n = {
    payee: (p: any) => (p.type === "venue" ? (p.venueId === 1 ? "房東丁丁" : "24steps") : p.type === "teacher" ? "Sean" : "高雄公積金"),
    venue: (id: number) => (id === 1 ? "房東丁丁" : "24steps"),
    teacher: () => "Sean",
    location: () => "高雄",
  };
  it("reads like spec 4.3", () => {
    expect(describeRow({ type: "fixed", amount: 300, to: { type: "venue", venueId: 1 } }, n)).toBe("場地 $300 → 房東丁丁");
    expect(describeRow({ type: "fixed", amount: 405, to: { type: "venue", venueId: 2 } }, n)).toBe("場地 $405 → 24steps");
    expect(describeRow({ type: "percentIncome", pct: 100 / 3, to: { type: "teacher", teacherId: 1 } }, n)).toBe("收入 1/3 → Sean");
    expect(describeRow({ type: "percentRemaining", pct: 10, to: { type: "fund", locationId: 1 } }, n)).toBe("剩下的 10% → 高雄公積金");
    expect(describeRow({ type: "venuePack", venueId: 2 }, n)).toBe("場地費 → 24steps");
    expect(describeRow({ type: "rest", rest: { type: "fund", locationId: 1 }, fundLocationId: 1 }, n)).toBe("剩下的 → 高雄公積金");
  });
});

describe("比重與剩下的", () => {
  it("比重 → 百分比；兩位都 1 → 平分", () => {
    const shares = [{ weight: 1 }, { weight: 1 }];
    expect(shareText(1, shares)).toBe("50%");
    expect(shareText(2, [{ weight: 2 }, { weight: 1 }])).toBe("66.7%");
  });

  it("describeRow：剩下的給多位老師時寫百分比", () => {
    const n = { payee: () => "", venue: () => "", teacher: (id: number) => (id === 1 ? "Sean" : "高雄搭檔"), location: () => "" };
    const row: RuleRow = {
      type: "rest",
      rest: { type: "teachers", shares: [{ teacherId: 1, weight: 1 }, { teacherId: 2, weight: 1 }] },
      fundLocationId: 1,
    };
    expect(describeRow(row, n)).toBe("剩下的 → Sean 50%、高雄搭檔 50%");
  });

  it("前面扣完剩下的：高雄課 $1,667 − 次數包 $405 ＝ $1,262", () => {
    const rows: RuleRow[] = [
      { type: "venuePack", venueId: 1 },
      { type: "percentRemaining", pct: 10, to: { type: "fund", locationId: 2 } },
      { type: "rest", rest: { type: "fund", locationId: 2 }, fundLocationId: 2 },
    ];
    expect(remainingBeforeRow(rows, 1, 1667, 405)).toEqual({ deducted: 405, remaining: 1262 });
    // 收入不夠 → 剩下的不小於 0
    expect(remainingBeforeRow(rows, 1, 300, 405).remaining).toBe(0);
  });
});

describe("試算 previewSplit", () => {
  it("台南：$3,000 → 兩位老師各 $1,000、場地 $300、公積金 $700", () => {
    const { items, deficit } = previewSplit(ruleToRows(tainan), 3000);
    expect(deficit).toBe(0);
    expect(items.map((i) => (i.kind === "payee" ? { ...i, amount: Math.round(i.amount) } : i))).toEqual([
      { kind: "payee", payee: { type: "teacher", teacherId: 1 }, amount: 1000 },
      { kind: "payee", payee: { type: "teacher", teacherId: 2 }, amount: 1000 },
      { kind: "payee", payee: { type: "venue", venueId: 7 }, amount: 300 },
      { kind: "payee", payee: { type: "fund", locationId: 5 }, amount: 700 },
    ]);
  });

  it("場地費知道價錢（每次付或目前這包）→ 算進去", () => {
    const { items, deficit, unknownVenue } = previewSplit(ruleToRows(kaohsiung), 1667, (id) => (id === 9 ? 405 : null));
    expect(unknownVenue).toBe(false);
    expect(items[0]).toEqual({ kind: "venuePack", venueId: 9, amount: 405 });
    expect(deficit).toBe(0);
    // 1667 − 405 − 350 = 912，公積金 10% = 91.2
    expect(items.find((i) => i.kind === "payee" && i.payee.type === "fund")).toMatchObject({ amount: 91.2 });
  });

  it("場地費不知道價錢 → 列出來、不算金額；不夠扣 → 差額由這堂課的基金吸收", () => {
    const { items, deficit, deficitFund, unknownVenue } = previewSplit(ruleToRows(kaohsiung), 300);
    expect(unknownVenue).toBe(true);
    expect(items[0]).toEqual({ kind: "venuePack", venueId: 9, amount: null });
    expect(deficit).toBe(50);
    expect(deficitFund).toBe(6);
    // 老師拿 0
    expect(items.filter((i) => i.kind === "payee" && i.payee.type === "teacher" && i.payee.teacherId !== 3).map((i) => i.kind === "payee" && i.amount)).toEqual([0, 0]);
  });

  it("新的比例行：第一行看收入，之後看剩下的", () => {
    const to = { type: "teacher" as const, teacherId: 1 };
    expect(newPercentRow(0, to).type).toBe("percentIncome");
    expect(newPercentRow(2, to).type).toBe("percentRemaining");
  });
});

describe("checkRule", () => {
  const n = {
    teacher: (id: number) => ({ 1: "Sean", 2: "Nini", 4: "Amy", 5: "Ben" })[id] ?? `#${id}`,
    location: (id: number) => ({ 5: "台南", 6: "高雄" })[id] ?? `#${id}`,
  };
  const teachersRest: RuleRow = {
    type: "rest",
    rest: { type: "teachers", shares: [{ teacherId: 1, weight: 1 }, { teacherId: 2, weight: 1 }] },
    fundLocationId: 5,
  };
  const t = (teacherId: number) => ({ type: "teacher" as const, teacherId });

  it("比例分得完：合計（剩下的換算成佔收入）＋剩下的給誰", () => {
    const rows: RuleRow[] = [
      { type: "percentIncome", pct: 50, to: { type: "fund", locationId: 5 } },
      { type: "percentRemaining", pct: 20, to: t(4) },
      teachersRest,
    ];
    expect(checkRule(rows, n)).toEqual({ ok: true, text: "分得完：比例合計 60%，剩下的給 Sean、Nini" });
  });

  it("沒有扣項：全部給剩下的", () => {
    expect(checkRule([teachersRest], n)).toEqual({ ok: true, text: "分得完：全部給 Sean、Nini" });
  });

  it("收入比例超過 100%：差額由剩下的公積金吸收", () => {
    const rows: RuleRow[] = [
      { type: "percentIncome", pct: 60, to: t(1) },
      { type: "percentIncome", pct: 50, to: t(2) },
      { type: "rest", rest: { type: "fund", locationId: 6 }, fundLocationId: 5 },
    ];
    expect(checkRule(rows, n)).toEqual({ ok: false, text: "比例合計 110%，超過的部分由高雄公積金吸收" });
  });

  it("固定金額：收入低於合計時由這堂課的基金吸收", () => {
    const rows: RuleRow[] = [
      { type: "fixed", amount: 2000, to: t(4) },
      { type: "fixed", amount: 500, to: { type: "venue", venueId: 7 } },
      teachersRest,
    ];
    expect(checkRule(rows, n)).toEqual({ ok: false, text: "固定金額合計 $2,500，收入低於這個數時由台南公積金吸收" });
  });

  it("固定金額＋收入比例：算出真正的門檻", () => {
    const rows = ruleToRows(tainan); // 1/3 + 1/3 + $300 → 至少 $900
    expect(checkRule(rows, n)).toEqual({ ok: false, text: "固定金額合計 $300，收入低於 $900 時由台南公積金吸收" });
  });

  it("「前面扣完剩下的」放在固定金額前面也算進門檻", () => {
    const rows: RuleRow[] = [
      { type: "percentRemaining", pct: 50, to: t(4) },
      { type: "fixed", amount: 600, to: t(5) },
      teachersRest,
    ];
    expect(checkRule(rows, n)?.text).toBe("固定金額合計 $600，收入低於 $1,200 時由台南公積金吸收");
  });

  it("場地費行用場地的價錢算門檻；不知道價錢就不算", () => {
    const rows: RuleRow[] = [{ type: "venuePack", venueId: 9 }, { type: "fixed", amount: 200, to: t(4) }, teachersRest];
    expect(checkRule(rows, n, () => 300)?.text).toBe("固定金額合計 $500，收入低於這個數時由台南公積金吸收");
    expect(checkRule(rows, n)?.text).toBe("固定金額合計 $200，收入低於這個數時由台南公積金吸收");
  });

  it("比例剛好 100%：剩下的拿 0", () => {
    const rows: RuleRow[] = [{ type: "percentIncome", pct: 100, to: t(4) }, teachersRest];
    expect(checkRule(rows, n)).toEqual({ ok: false, text: "比例合計 100%，剩下的 Sean、Nini 拿 0" });
  });

  it("還沒選老師時不說話（交給 validateRows）", () => {
    const rows: RuleRow[] = [{ type: "rest", rest: { type: "teachers", shares: [] }, fundLocationId: 5 }];
    expect(checkRule(rows, n)).toBeNull();
  });
});

describe("deficitFundOf", () => {
  it("剩下的給公積金 → 那個公積金吸收；給老師 → 這堂課的基金", () => {
    expect(deficitFundOf({ type: "rest", rest: { type: "fund", locationId: 3 }, fundLocationId: 5 })).toBe(3);
    expect(deficitFundOf({ type: "rest", rest: { type: "teachers", shares: [{ teacherId: 1, weight: 1 }] }, fundLocationId: 5 })).toBe(5);
  });
});
