import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  companyMoney,
  crateCount,
  heldDays,
  holdingOf,
  isOverdue,
  lastRejection,
  ledgerRows,
  nextId,
  remitAmountError,
  townReducer,
  placeEntries,
  remittancesOf,
  vaultMonthFlow,
  type TownAction,
  type TownState,
} from "./townModel";

const run = (...actions: TownAction[]): TownState => actions.reduce(townReducer, INITIAL_STATE);

describe("示意資料的起始數字（跟設計稿一致）", () => {
  it("公司的錢 $58,300 = 財庫 $46,700 + 手上 $5,800 + 路上 $5,800", () => {
    const money = companyMoney(INITIAL_STATE);
    expect(money.vault).toBe(46700);
    expect(money.custody).toBe(5800);
    expect(money.transit).toBe(5800);
    expect(money.total).toBe(58300);
  });

  it("拆成預收 $31,000、待發 $17,800、水庫基金 $9,500", () => {
    const money = companyMoney(INITIAL_STATE);
    expect([money.prepaid, money.payable, money.fund]).toEqual([31000, 17800, 9500]);
    expect(money.netWorth).toBe(9500 - 120000);
    expect(money.recovery).toBeCloseTo(9500 / 120000);
  });

  it("丁丁手上 $2,000（10/26 收的），老師 B 手上 $3,800 已經 32 天沒繳", () => {
    expect(holdingOf(INITIAL_STATE, "dd")).toBe(2000);
    expect(heldDays(INITIAL_STATE, "dd")).toBe(2);
    expect(holdingOf(INITIAL_STATE, "teacherB")).toBe(3800);
    expect(heldDays(INITIAL_STATE, "teacherB")).toBe(32);
    expect(isOverdue(INITIAL_STATE, "teacherB")).toBe(true);
    expect(isOverdue(INITIAL_STATE, "dd")).toBe(false);
  });

  it("老闆沒有背包；47 箱；10 月進 $29,600、出 $30,900", () => {
    expect(holdingOf(INITIAL_STATE, "boss")).toBe(0);
    expect(crateCount(46700)).toBe(47);
    expect(vaultMonthFlow(INITIAL_STATE)).toEqual({ inflow: 29600, outflow: 30900 });
  });
});

describe("繳回", () => {
  it("確認收到：路上的錢進財庫，公司的錢總數不變", () => {
    const after = run({ type: "confirm", id: "r2" });
    const money = companyMoney(after);
    expect(money.transit).toBe(0);
    expect(money.vault).toBe(46700 + 5800);
    expect(money.total).toBe(58300);
    expect(crateCount(money.vault)).toBe(53);
  });

  it("退回：錢回到代收人手上，背包標「被退回」，再送一次就消失", () => {
    const rejected = run({ type: "reject", id: "r2", reason: "少了 $200" });
    expect(holdingOf(rejected, "dd")).toBe(7800);
    expect(lastRejection(rejected, "dd")?.reason).toBe("少了 $200");
    const resent = townReducer(rejected, { type: "remit", fromId: "dd", amount: 7800, method: "cash", date: "2026-10-28" });
    expect(lastRejection(resent, "dd")).toBeNull();
    expect(holdingOf(resent, "dd")).toBe(0);
  });

  it("撤回跟退回一樣把錢放回手上，但不算被退回", () => {
    const withdrawn = run({ type: "withdraw", id: "r2" });
    expect(holdingOf(withdrawn, "dd")).toBe(7800);
    expect(lastRejection(withdrawn, "dd")).toBeNull();
  });

  it("只有還沒確認的能確認、退回或撤回", () => {
    const after = run({ type: "reject", id: "r1", reason: "x" }, { type: "withdraw", id: "r1" });
    expect(after.remittances.find((r) => r.id === "r1")?.status).toBe("confirmed");
  });

  it("老師 B 送回之後就不再逾期（先進先出）", () => {
    const after = run({ type: "remit", fromId: "teacherB", amount: 3800, method: "transfer", ref: "12345", date: "2026-10-28" });
    expect(holdingOf(after, "teacherB")).toBe(0);
    expect(isOverdue(after, "teacherB")).toBe(false);
    expect(companyMoney(after).transit).toBe(5800 + 3800);
  });

  it("送一部分：剩下的錢還是從最早那筆算天數", () => {
    const after = run({ type: "collect", receiverId: "teacherB", student: "新同學", item: "單堂", amount: 350, method: "cash" }, {
      type: "remit",
      fromId: "teacherB",
      amount: 3800,
      method: "cash",
      date: "2026-10-28",
    });
    expect(holdingOf(after, "teacherB")).toBe(350);
    expect(heldDays(after, "teacherB")).toBe(0);
  });

  it("金額檢查", () => {
    expect(remitAmountError(0, 2000)).toBe("請輸入要送回的金額");
    expect(remitAmountError(10.5, 2000)).toBe("金額要是整數");
    expect(remitAmountError(2500, 2000)).toBe("背包裡只有 $2,000");
    expect(remitAmountError(2000, 2000)).toBeNull();
  });
});

describe("收款與老闆記帳", () => {
  it("學生付給丁丁：丁丁背包變多、預收變多、基金不變", () => {
    const after = run({ type: "collect", receiverId: "dd", student: "新同學", item: "一般課卡 6 堂", amount: 2000, method: "cash" });
    expect(holdingOf(after, "dd")).toBe(4000);
    const money = companyMoney(after);
    expect(money.prepaid).toBe(33000);
    expect(money.fund).toBe(9500);
  });

  it("學生付給老闆：直接進財庫", () => {
    const after = run({ type: "collect", receiverId: "boss", student: "新同學", item: "單堂", amount: 350, method: "cash" });
    expect(companyMoney(after).vault).toBe(47050);
  });

  it("發薪從待發扣、Party 從基金扣", () => {
    const salary = run({ type: "record", category: "salary", amount: 5000, note: "10 月薪資（部分）" });
    expect(companyMoney(salary)).toMatchObject({ vault: 41700, payable: 12800, fund: 9500 });
    const party = run({ type: "record", category: "party", amount: 1200, note: "萬聖節 Party" });
    expect(companyMoney(party)).toMatchObject({ vault: 45500, payable: 17800, fund: 8300 });
  });

  it("老闆補錢：財庫變多、欠老闆的也變多，淨值不變", () => {
    const before = companyMoney(INITIAL_STATE);
    const after = companyMoney(run({ type: "record", category: "loan", amount: 10000, note: "先補一點" }));
    expect(after.vault).toBe(before.vault + 10000);
    expect(after.loan).toBe(before.loan + 10000);
    expect(after.netWorth).toBe(before.netWorth);
  });

  it("新資料的 id 用流水號，重來回到起始資料", () => {
    expect(nextId(INITIAL_STATE, "r")).toBe("r101");
    const after = run({ type: "record", category: "other", amount: 100, note: "x" }, { type: "reset" });
    expect(after).toBe(INITIAL_STATE);
  });
});

describe("地方與紀錄", () => {
  it("場地費、助教費記在地方上；其他分類不掛地方", () => {
    expect(placeEntries(INITIAL_STATE, "tainan").map((e) => e.id)).toEqual(["e6", "e4", "e3"]);
    expect(placeEntries(INITIAL_STATE, "kaohsiung").map((e) => e.id)).toEqual(["e1"]);
    const after = run(
      { type: "record", category: "venue", amount: 500, note: "台南場地費 10/28", place: "tainan" },
      { type: "record", category: "party", amount: 300, note: "飲料", place: "tainan" }
    );
    expect(placeEntries(after, "tainan")[0].note).toBe("台南場地費 10/28");
    expect(after.entries[after.entries.length - 1].place).toBeUndefined();
  });

  it("送回紀錄包含退回、撤回", () => {
    const after = run({ type: "reject", id: "r2", reason: "少了" });
    expect(remittancesOf(after, "dd").map((r) => r.status)).toEqual(["rejected", "confirmed"]);
  });
});

describe("帳本", () => {
  it("新的在上面；確認過的繳回算主堡、還沒確認的算代收", () => {
    const rows = ledgerRows(INITIAL_STATE);
    expect(rows[0].date >= rows[rows.length - 1].date).toBe(true);
    expect(rows.find((r) => r.id === "r1")?.scope).toBe("vault");
    expect(rows.find((r) => r.id === "r2")?.scope).toBe("custody");
  });
});
