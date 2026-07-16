import { describe, it, expect } from "vitest";
import { periodRevenue } from "./income";

// 每堂課營收 = Σ 已扣卡學生的「該卡單堂價」(finalPrice / totalSessions)。
// 這是 income/daily-summary 與每日彙總畫面的金額來源，釘死它避免日後改錯。

const withCard = (finalPrice: number, totalSessions: number) => ({
  studentCard: { finalPrice, totalSessions },
});
const noCard = { studentCard: null };

describe("periodRevenue", () => {
  it("沒有任何紀錄 → 0", () => {
    expect(periodRevenue([])).toBe(0);
  });

  it("單堂價 = finalPrice / totalSessions", () => {
    // 3000 元 / 6 堂 = 500
    expect(periodRevenue([withCard(3000, 6)])).toBe(500);
  });

  it("多名扣卡學生 → 各自單堂價加總", () => {
    // 500 + 250 = 750
    expect(periodRevenue([withCard(3000, 6), withCard(1500, 6)])).toBe(750);
  });

  it("未扣卡 (studentCard 為 null) 不計入營收", () => {
    expect(periodRevenue([withCard(3000, 6), noCard, noCard])).toBe(500);
  });

  it("全部未扣卡 → 0", () => {
    expect(periodRevenue([noCard, noCard])).toBe(0);
  });

  it("折扣後的 finalPrice 反映在營收（非用原價）", () => {
    // 學生實付 2400（原價 3000 打八折），6 堂 → 單堂 400
    expect(periodRevenue([withCard(2400, 6)])).toBe(400);
  });
});
