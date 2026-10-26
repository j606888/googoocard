/**
 * 水庫的分帳計算（純函式，伺服器與畫面共用）。
 * 搬自 water-tank `src/lib/split.ts`；`classShare` 是 water-tank 規格 §8.1 的「每堂認列金額」。
 */

export type RoundUnit = 1 | 10 | 100;

export const ROUND_UNITS: readonly RoundUnit[] = [1, 10, 100];

export type SplitInput = {
  income: number;
  rent: number;
  /** 水庫提撥比例，例如 0.1 = 10% */
  poolRate: number;
  memberCount: number;
  roundUnit: RoundUnit;
};

export type SplitResult = {
  income: number;
  rent: number;
  /** 收入 − 場租，最少是 0 */
  distributable: number;
  /** 提撥進水庫（四捨五入到元） */
  pool: number;
  /** 提撥後剩下要分給老師的 */
  remaining: number;
  /** 每人未取整 */
  perMember: number;
  /** 每人取整後 */
  perMemberRounded: number;
  /** 取整後的零頭，歸水庫 */
  leftover: number;
  /** 本堂流入水庫合計＝提撥＋零頭 */
  toTank: number;
};

/**
 * 以一堂課為單位計算分帳：扣場租 → 提撥水庫 → 平分 → 無條件捨去取整，零頭歸水庫。
 *
 * - 場租比收入多：沒有可分配的錢，全部是 0（虧的部分不在這裡處理）。
 * - 沒有授課成員：提撥後剩下的全部當零頭歸水庫。
 * - 收入、場租是負數（打錯）當 0 算。
 */
export function calculateSplit({ income, rent, poolRate, memberCount, roundUnit }: SplitInput): SplitResult {
  const distributable = Math.max(0, Math.max(0, income) - Math.max(0, rent));
  const pool = Math.round(distributable * poolRate);
  const remaining = distributable - pool;
  const members = Math.max(0, Math.floor(memberCount));
  const perMember = members > 0 ? remaining / members : 0;
  // 先四捨五入到分再取整：收入有小數（課卡攤提到分）時，1024.07 − 0.07 會算成
  // 1023.9999…，直接捨去會少掉一整個單位。
  const perMemberRounded = Math.floor(Math.round(perMember * 100) / 100 / roundUnit) * roundUnit;
  const leftover = remaining - perMemberRounded * members;

  return {
    income,
    rent,
    distributable,
    pool,
    remaining,
    perMember,
    perMemberRounded,
    leftover,
    toTank: pool + leftover,
  };
}

/**
 * 一張課卡的第 `nth` 堂要認列多少收入（water-tank 規格 §8.1，「最後一堂補零頭」）：
 * 前面每堂是單堂價捨去到分，最後一堂把剩下的零頭補齊，加總剛好等於售價。
 *
 * 6 堂 2,000 → 前 5 堂 333.33、第 6 堂 333.35；單堂 400 → 400。
 *
 * 第 4 階段要把這條公式併進 `src/lib/income.ts` 的 `periodRevenue`（收入只有一套定義）。
 */
export function classShare({ price, classes, nth }: { price: number; classes: number; nth: number }): number {
  if (!Number.isInteger(classes) || classes < 1) throw new RangeError(`classes 要是正整數：${classes}`);
  if (!Number.isInteger(nth) || nth < 1 || nth > classes) throw new RangeError(`第 ${nth} 堂不在 1–${classes} 之間`);

  // 全部用「分」算，避免浮點誤差。
  const priceCents = Math.round(price * 100);
  const baseCents = Math.floor(priceCents / classes);
  const cents = nth < classes ? baseCents : priceCents - baseCents * (classes - 1);
  return cents / 100;
}
