export function formatMoney(amount: number): string {
  return Math.round(amount).toLocaleString();
}

// 吃 "2026-08" 或 "2026-08-01" 皆可 → "2026 年 8 月"
export function monthLabel(dateOrMonth: string): string {
  const [year, month] = dateOrMonth.split("-").map(Number);
  return `${year} 年 ${month} 月`;
}

// 圖表 x 軸用的短標籤 → "8月"
export function shortMonthLabel(month: string): string {
  return `${Number(month.split("-")[1])}月`;
}
