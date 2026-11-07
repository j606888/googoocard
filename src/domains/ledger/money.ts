// 帳本金額一律以「分」（整數）計算與儲存：NT$333.33 → 33333。見 docs/finance-v2/03-architecture.md §2。

/** 元 → 分，四捨五入到分。 */
export function toCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 分 → 元（給畫面顯示；顯示時再交給 formatMoney 四捨五入）。 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * 把 total 分成 n 份，每份相同，最後一份吃尾差，加總永遠等於 total。
 * 例：200000 分給 6 格 → 5 × 33333 + 33335。
 */
export function splitEvenly(total: number, n: number): number[] {
  if (!Number.isInteger(total)) throw new Error(`splitEvenly: total must be integer cents, got ${total}`);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`splitEvenly: n must be a positive integer, got ${n}`);
  const base = Math.trunc(total / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] = total - base * (n - 1);
  return parts;
}

/**
 * 一張卡第 k 格（0 起算）到第 k+count-1 格的價值總和（分）。
 * 卡的實收（元）÷ 格數，最後一格吃尾差，讓一張卡的預收剛好歸零（02 §3.2）。
 * 格子依使用順序編號：第一次使用的是第 0 格。
 */
export function sessionSliceValue(priceYuan: number, totalSessions: number, from: number, count: number): number {
  if (totalSessions <= 0 || count <= 0) return 0;
  const parts = splitEvenly(toCents(priceYuan), totalSessions);
  let sum = 0;
  for (let i = from; i < from + count && i < totalSessions; i++) sum += parts[i];
  return sum;
}
