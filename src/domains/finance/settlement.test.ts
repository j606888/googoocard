import { describe, it, expect } from "vitest";
import { planSettlement, type CashHolding, type Payee } from "./settlement";

const tank = { owner: "老闆", account: "教室帳戶" };

describe("planSettlement", () => {
  // water-tank 10 月月結的示意資料：丁丁保管台南小水庫、老師 B 收了高雄的課卡現金。
  const payees: Payee[] = [
    { name: "丁丁", owed: 23460 },
    { name: "老師 B", owed: 17820 },
    { name: "老師 C", owed: 10350 },
    { name: "老師 D", owed: 6900 },
  ];
  const holdings: CashHolding[] = [
    { name: "丁丁", source: "台南小水庫現金", amount: 14250, reserve: 2000 },
    { name: "老師 B", source: "高雄課卡現金", amount: 19600 },
  ];

  it("多據點：手上的現金先抵分潤，不夠的由大水庫補、多的繳回", () => {
    const { lines, transfers } = planSettlement({ payees, holdings, tank });

    expect(lines).toEqual([
      { name: "丁丁", owed: 23460, offset: 12250, net: 11210 },
      { name: "老師 B", owed: 17820, offset: 19600, net: -1780 },
      { name: "老師 C", owed: 10350, offset: 0, net: 10350 },
      { name: "老師 D", owed: 6900, offset: 0, net: 6900 },
    ]);

    expect(transfers.map((t) => [t.kind, t.from, t.to, t.amount, t.executor, t.confirmer])).toEqual([
      ["payout", "教室帳戶", "丁丁", 11210, "老闆", "丁丁"],
      ["remit", "老師 B", "教室帳戶", 1780, "老師 B", "老闆"],
      ["payout", "教室帳戶", "老師 C", 10350, "老闆", "老師 C"],
      ["payout", "教室帳戶", "老師 D", 6900, "老闆", "老師 D"],
    ]);
  });

  it("每筆轉帳帶著怎麼算出來的（分潤、手上可抵），不再拼好字串", () => {
    const { transfers } = planSettlement({ payees, holdings, tank });
    const dingding = transfers.find((t) => t.to === "丁丁")!;
    expect(dingding).toMatchObject({ owed: 23460, offset: 12250, amount: 11210 });
    expect(dingding).not.toHaveProperty("note");
    expect(transfers.find((t) => t.to === "老師 C")).toMatchObject({ owed: 10350, offset: 0 });
  });

  it("同一個人在兩個據點都收了錢：全部加起來抵，零用金按每一筆各自扣", () => {
    const { lines, transfers } = planSettlement({
      payees: [{ name: "丁丁", owed: 20000 }],
      holdings: [
        { name: "丁丁", source: "台南小水庫", amount: 12000, reserve: 2000 },
        { name: "丁丁", source: "高雄課卡現金", amount: 5000 },
      ],
      tank,
    });
    expect(lines).toEqual([{ name: "丁丁", owed: 20000, offset: 15000, net: 5000 }]);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ kind: "payout", amount: 5000 });
  });

  it("全部的錢 = 分潤：大水庫轉出的 − 繳回的 = 分潤合計 − 拿來抵的", () => {
    const { lines, transfers } = planSettlement({ payees, holdings, tank });
    const paidOut = transfers.filter((t) => t.kind === "payout").reduce((s, t) => s + t.amount, 0);
    const remitted = transfers.filter((t) => t.kind === "remit").reduce((s, t) => s + t.amount, 0);
    const owed = lines.reduce((s, l) => s + l.owed, 0);
    const offset = lines.reduce((s, l) => s + l.offset, 0);
    expect(paidOut - remitted).toBe(owed - offset);
  });

  it("剛好抵完的人不用轉", () => {
    const { lines, transfers } = planSettlement({
      payees: [{ name: "老師 B", owed: 8000 }],
      holdings: [{ name: "老師 B", source: "高雄課卡現金", amount: 8000 }],
      tank,
    });
    expect(lines[0].net).toBe(0);
    expect(transfers).toEqual([]);
  });

  it("手上的錢比零用金少：那一筆不抵，也不會變成負的", () => {
    const { lines } = planSettlement({
      payees: [{ name: "丁丁", owed: 5000 }],
      holdings: [{ name: "丁丁", source: "台南小水庫", amount: 1500, reserve: 2000 }],
      tank,
    });
    expect(lines[0]).toMatchObject({ offset: 0, net: 5000 });
  });

  it("只持有現金、沒有分潤的人（例如小幫手）：全部繳回", () => {
    const { lines, transfers } = planSettlement({
      payees: [{ name: "丁丁", owed: 1000 }],
      holdings: [{ name: "小幫手", source: "體驗課現金", amount: 1800 }],
      tank,
    });
    expect(lines.map((l) => l.name)).toEqual(["丁丁", "小幫手"]);
    expect(transfers[1]).toMatchObject({ kind: "remit", from: "小幫手", amount: 1800, owed: 0, offset: 1800 });
  });

  it("同一個人在分潤名單出現兩次就加總", () => {
    const { lines } = planSettlement({
      payees: [
        { name: "老師 C", owed: 3000 },
        { name: "老師 C", owed: 2000 },
      ],
      holdings: [],
      tank,
    });
    expect(lines).toEqual([{ name: "老師 C", owed: 5000, offset: 0, net: 5000 }]);
  });

  it("沒有人就沒有轉帳", () => {
    expect(planSettlement({ payees: [], holdings: [], tank })).toEqual({ lines: [], transfers: [] });
  });
});
