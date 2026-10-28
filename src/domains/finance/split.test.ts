import { describe, it, expect } from "vitest";
import {
  allocate,
  allocateFees,
  resolveRule,
  splitPeriod,
  type PeriodInput,
  type ResolvedRule,
  type RuleLayer,
} from "./split";

const SEAN = 1;
const NINI = 2;
const KATHY = 3;
const DINGDING = 4;
const AKAI = 5;

// Bailamore：拆帳、抽 10%、捨去到十位、零頭歸 Sean。
const classroom: RuleLayer = {
  id: 10,
  teacherPay: "SPLIT",
  commissionPct: 10,
  roundTo: 10,
  remainderTo: "REVENUE_OWNER",
  assistantMode: "PER_DAY",
  assistantAmount: 250,
};
const tainan: RuleLayer = { id: 20, venueMode: "PER_DAY", venueAmount: 500, venuePayee: "MEMBER", venueTeacherId: DINGDING };
const kaohsiung: RuleLayer = { id: 21, venueMode: "PER_LESSON", venueAmount: 405, venuePayee: "EXTERNAL" };

let nextId = 100;
const period = (
  hour: number,
  revenue: number,
  teacherIds: number[],
  rule: ResolvedRule,
  extra: Partial<PeriodInput> = {}
): PeriodInput => ({
  periodId: nextId++,
  startTime: new Date(`2026-09-13T${String(hour - 8).padStart(2, "0")}:00:00Z`),
  dateKey: "2026-09-13",
  locationId: 1,
  revenue,
  estimated: 0,
  teacherIds,
  assistantIds: [],
  rule,
  ...extra,
});

const run = (periods: PeriodInput[]) => {
  const fees = allocateFees(periods);
  return periods.map((p) => splitPeriod(p, fees.get(p.periodId)!, { revenueOwnerTeacherId: SEAN }));
};

describe("allocate", () => {
  it("除不盡的早的堂多 1 元", () => {
    expect(allocate(500, 3)).toEqual([167, 167, 166]);
    expect(allocate(250, 3)).toEqual([84, 83, 83]);
    expect(allocate(500, 1)).toEqual([500]);
    expect(allocate(500, 0)).toEqual([]);
  });
});

describe("resolveRule", () => {
  it("什麼都沒設＝不用算", () => {
    expect(resolveRule({})).toMatchObject({ teacherPay: "NONE", venueMode: "NONE", commissionPct: 0, roundTo: 1, remainderTo: "FUND", ruleIds: [] });
  });

  it("課程 → 分部 → 全教室，逐欄沿用", () => {
    const lesson: RuleLayer = { id: 30, venueMode: "NONE", commissionPct: 0 };
    const rule = resolveRule({ classroom, location: tainan, lesson });
    expect(rule).toMatchObject({ teacherPay: "SPLIT", venueMode: "NONE", venueAmount: 500, commissionPct: 0, roundTo: 10 });
    expect(rule.ruleIds).toEqual([30, 20, 10]);
  });

  it("取整、零頭只看全教室；比例、手動只看課程", () => {
    const rule = resolveRule({
      classroom,
      location: { id: 20, roundTo: 100, shares: [{ teacherId: SEAN, pct: 100 }] } as RuleLayer,
    });
    expect(rule.roundTo).toBe(10);
    expect(rule.shares).toEqual([]);
  });
});

describe("splitPeriod：Bailamore 9 月真的點名", () => {
  it("9/13 台南 3 堂：場地 $500 平攤、抽 10%、捨去到十位", () => {
    const rule = resolveRule({ classroom, location: tainan });
    const [body, bachata, salsa] = run([
      period(14, 2033, [SEAN], rule),
      period(15, 3050, [SEAN], rule),
      period(16, 1167, [NINI], rule),
    ]);
    expect(body).toMatchObject({ venueFee: 167, venueTeacherId: DINGDING, commission: 187, teacherLines: [{ teacherId: SEAN, amount: 1670 }], remainder: 9 });
    expect(bachata).toMatchObject({ venueFee: 167, commission: 288, teacherLines: [{ teacherId: SEAN, amount: 2590 }], remainder: 5 });
    // 零頭歸 Sean，就算這堂是 Nini 教的
    expect(salsa).toMatchObject({ venueFee: 166, commission: 100, teacherLines: [{ teacherId: NINI, amount: 900 }], remainder: 1, remainderTeacherId: SEAN });
    expect(salsa.fund).toBe(100);
  });

  it("9/17 高雄：每堂固定 $405，付給外面的場地", () => {
    const rule = resolveRule({ classroom, location: kaohsiung });
    const [kizomba, training] = run([period(19, 1333, [SEAN], rule), period(20, 3000, [SEAN], rule)]);
    expect(kizomba).toMatchObject({ venueFee: 405, venueTeacherId: null, commission: 93, teacherLines: [{ teacherId: SEAN, amount: 830 }], remainder: 5 });
    expect(training).toMatchObject({ commission: 260, teacherLines: [{ teacherId: SEAN, amount: 2330 }] });
  });

  it("10/25 台南有助教：每天 $250 也平攤，抽成前扣", () => {
    const rule = resolveRule({ classroom, location: tainan });
    const results = run([
      period(14, 2333, [SEAN], rule, { assistantIds: [AKAI] }),
      period(15, 2983, [SEAN], rule, { assistantIds: [AKAI], estimated: 300 }),
      period(16, 1500, [NINI], rule, { assistantIds: [AKAI] }),
    ]);
    expect(results.map((r) => r.assistantFee)).toEqual([84, 83, 83]);
    expect(results.map((r) => r.commission)).toEqual([208, 273, 125]);
    expect(results.map((r) => r.teacherLines[0].amount)).toEqual([1870, 2460, 1120]);
    expect(results[1].flags).toContain("NO_CARD");
    expect(results.reduce((sum, r) => sum + r.fund, 0)).toBe(606);
  });

  it("課程比例：Sean 60%、Kathy 40%；少掛一位就平分給掛著的人並標出來", () => {
    const lesson: RuleLayer = { id: 31, shares: [{ teacherId: SEAN, pct: 60 }, { teacherId: KATHY, pct: 40 }] };
    const rule = resolveRule({ classroom, location: kaohsiung, lesson });
    const [both, onlySean] = run([period(20, 4000, [SEAN, KATHY], rule), period(21, 4000, [SEAN], rule)]);
    expect(both.teacherLines).toEqual([{ teacherId: SEAN, amount: 1940 }, { teacherId: KATHY, amount: 1290 }]);
    expect(both.remainder).toBe(5);
    expect(onlySean.flags).toContain("MISSING_SHARE_TEACHER");
    expect(onlySean.teacherLines).toEqual([{ teacherId: SEAN, amount: 3230 }]);
  });

  it("台南週二例外：不扣場地、不抽成；不算進當天平攤", () => {
    const exception: RuleLayer = { id: 32, venueMode: "NONE", commissionPct: 0 };
    const normal = resolveRule({ classroom, location: tainan });
    const tuesday = resolveRule({ classroom, location: tainan, lesson: exception });
    const [a, b] = run([period(19, 800, [DINGDING], tuesday), period(20, 2000, [SEAN], normal)]);
    expect(a).toMatchObject({ venueFee: 0, commission: 0, teacherLines: [{ teacherId: DINGDING, amount: 800 }] });
    expect(b.venueFee).toBe(500);
  });
});

describe("splitPeriod：其他教室", () => {
  it("鐘點費：老師拿固定的錢，剩下的留在教室", () => {
    const rule = resolveRule({ classroom: { id: 1, teacherPay: "HOURLY", hourlyFee: 800, venueMode: "PER_LESSON", venueAmount: 600 } });
    const [r] = run([period(19, 2400, [NINI], rule)]);
    expect(r).toMatchObject({ venueFee: 600, commission: 0, teacherLines: [{ teacherId: NINI, amount: 800 }], fund: 1000 });
  });

  it("不用算：收入全部留在教室", () => {
    const [r] = run([period(19, 2400, [NINI], resolveRule({}))]);
    expect(r).toMatchObject({ teacherLines: [], fund: 2400, flags: [] });
  });

  it("收入不夠付場地：不抽成、老師拿 0，差額由教室吸收", () => {
    const rule = resolveRule({ classroom, location: kaohsiung });
    const [r] = run([period(19, 300, [SEAN], rule)]);
    expect(r).toMatchObject({ commission: 0, teacherLines: [{ teacherId: SEAN, amount: 0 }], fund: -105 });
  });

  it("要分給老師卻沒掛老師", () => {
    const [r] = run([period(19, 1000, [], resolveRule({ classroom }))]);
    expect(r.flags).toContain("NO_TEACHER");
    expect(r.fund).toBe(1000);
  });
});
