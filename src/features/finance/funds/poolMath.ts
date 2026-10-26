import type { BranchPool, PoolMovement } from "../types";

/** 可繳回＝餘額 − 保留零用金（最少 0）。 */
export function remittable(pool: Pick<BranchPool, "balance" | "reserve">): number {
  return Math.max(0, pool.balance - pool.reserve);
}

/** 可繳回已經超過提醒門檻。 */
export function overThreshold(pool: Pick<BranchPool, "balance" | "reserve" | "alertThreshold">): boolean {
  return remittable(pool) >= pool.alertThreshold;
}

/** 進出（新到舊）加上「這筆之後的餘額」，從目前餘額往回推。 */
export function withRunningBalance(
  movements: PoolMovement[],
  currentBalance: number
): (PoolMovement & { balance: number })[] {
  let balance = currentBalance;
  return movements.map((movement) => {
    const row = { ...movement, balance };
    balance -= movement.amount;
    return row;
  });
}
