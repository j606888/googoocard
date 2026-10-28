import { describe, expect, it } from "vitest";
import type { Transaction, Transfer } from "../types";
import {
  ALL,
  EMPTY_FILTERS,
  TRANSFER_CATEGORY,
  filterItems,
  groupByDate,
  isFiltered,
  itemKey,
  ledgerItems,
  ledgerTotals,
} from "./ledgerFilters";

const entry = (id: number, date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id,
  date,
  category: amount > 0 ? "點名收入" : "場租",
  description: `第 ${id} 筆`,
  branch: "台南",
  holder: "丁丁 · 現金",
  amount,
  history: [{ type: "created", by: "丁丁", at: `${date} 21:${String(id).padStart(2, "0")}` }],
  ...extra,
});

const archived = (tx: Transaction): Transaction => ({
  ...tx,
  history: [...tx.history, { type: "archived", by: "丁丁", at: "10/24 09:00", reason: "重複" }],
});

const transfer: Transfer = {
  id: "T-1",
  date: "10/23",
  from: "丁丁 · 現金",
  to: "老師 B · 現金",
  fromBranch: "台南",
  toBranch: "高雄",
  receiver: "老師 B",
  amount: 6000,
  method: "cash",
  note: "場租週轉",
  sent: { by: "丁丁", at: "10/23 21:30" },
};

const entries = [entry(1, "10/22", 800), entry(2, "10/23", -250), entry(3, "10/23", 2000), archived(entry(4, "10/23", -360))];
const items = ledgerItems(entries, [transfer]);

describe("ledgerItems", () => {
  it("日期新到舊，同一天後記的在上面，轉移穿插在裡面", () => {
    expect(items.map(itemKey)).toEqual(["T-1", "e4", "e3", "e2", "e1"]);
  });
});

describe("filterItems", () => {
  it("預設藏起封存的", () => {
    expect(filterItems(items, EMPTY_FILTERS).map(itemKey)).toEqual(["T-1", "e3", "e2", "e1"]);
  });

  it("勾了「顯示封存」就看得到", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, showArchived: true })).toHaveLength(5);
  });

  it("選一般類別時轉移不出現；選「轉移」只剩轉移", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, category: "場租" }).map(itemKey)).toEqual(["e2"]);
    expect(filterItems(items, { ...EMPTY_FILTERS, category: TRANSFER_CATEGORY }).map(itemKey)).toEqual(["T-1"]);
  });

  it("據點、經手人：轉移的兩端任一邊符合就算", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, branch: "高雄" }).map(itemKey)).toEqual(["T-1"]);
    expect(filterItems(items, { ...EMPTY_FILTERS, holder: "老師 B · 現金" }).map(itemKey)).toEqual(["T-1"]);
  });

  it("搜尋說明、記錄人、轉移的備註", () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, query: "週轉" }).map(itemKey)).toEqual(["T-1"]);
    expect(filterItems(items, { ...EMPTY_FILTERS, query: " 第 3 " }).map(itemKey)).toEqual(["e3"]);
  });

  it("「顯示封存」不算篩選", () => {
    expect(isFiltered({ ...EMPTY_FILTERS, showArchived: true })).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, branch: "台南" })).toBe(true);
    expect(isFiltered({ ...EMPTY_FILTERS, category: ALL, query: "  " })).toBe(false);
  });
});

describe("groupByDate", () => {
  it("一天一組，順序不變", () => {
    const days = groupByDate(items);
    expect(days.map((d) => d.date)).toEqual(["10/23", "10/22"]);
    expect(days[0].items.map(itemKey)).toEqual(["T-1", "e4", "e3", "e2"]);
  });
});

describe("ledgerTotals", () => {
  it("封存的不算，轉移另外算", () => {
    expect(ledgerTotals(items)).toEqual({
      income: 2800,
      expense: -250,
      incomeCount: 2,
      expenseCount: 1,
      transferAmount: 6000,
      transferCount: 1,
    });
  });
});
