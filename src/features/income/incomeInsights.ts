import type { CardPurchase, DailyTotal, CardMonthlyTotal } from "./types";

/**
 * 收入頁的純推導：月總額、卡種拆分、CSV。資料都已經在前端（月列表與單月明細），
 * 不另外打 API。課卡營收的定義跟 card-monthly 一致：只算已付款。
 */

/** 某月的課程收入：從每日列表加總。 */
export const sessionMonthTotal = (days: DailyTotal[], month: string): number =>
  days.reduce((sum, d) => (d.date.startsWith(month) ? sum + d.totalRevenue : sum), 0);

/** 某月的課卡收入（已付款），沒有資料回 0。 */
export const cardMonthTotal = (months: CardMonthlyTotal[], month: string): number =>
  months.find((m) => m.month === month)?.totalRevenue ?? 0;

export interface CardTypeTotal {
  cardName: string;
  count: number;
  revenue: number;
}

/** 依卡種加總已付款的購買，金額大的在前。 */
export const groupPurchasesByCard = (purchases: CardPurchase[]): CardTypeTotal[] => {
  const byName = new Map<string, CardTypeTotal>();
  for (const p of purchases) {
    if (!p.isPaid) continue;
    const entry = byName.get(p.cardName) ?? { cardName: p.cardName, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += p.finalPrice;
    byName.set(p.cardName, entry);
  }
  return [...byName.values()].sort((a, b) => b.revenue - a.revenue);
};

const csvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** 對帳用的 CSV（含未付款，另一欄標示）。開頭加 BOM，Excel 打開中文才不會亂碼。 */
export const purchasesToCsv = (purchases: CardPurchase[]): string => {
  const rows = [
    ["日期", "學生", "課卡", "金額", "付款"],
    ...purchases.map((p) => [p.date, p.studentName, p.cardName, p.finalPrice, p.isPaid ? "已付款" : "未付款"]),
  ];
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\n");
};
