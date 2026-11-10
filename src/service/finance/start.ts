// 財務的起算日＝轉換日（Classroom.financeConversionDate，開帳時選）。唯一的來源：
// 時段財務、過期收入、收款人整理、之前的次數包、帳本過帳都從這裡讀。
// 還沒開帳（financeOpenedAt 為 null）→ null：這些功能視為「還沒開始」。
// financeEnabledAt 只代表「開了財務」（開財務的那一刻），不再當日期用。
import prisma from "@/lib/prisma";
import { parseTaipeiDateRange } from "@/lib/taipei-date";

export type FinanceStart = {
  /** 轉換日（台北日期 YYYY-MM-DD） */
  dateKey: string;
  /** 轉換日台北 00:00 */
  start: Date;
};

type StartColumns = { financeOpenedAt: Date | null; financeConversionDate: Date | null };

export const financeStartSelect = { financeOpenedAt: true, financeConversionDate: true } as const;

/** 已開帳 → 轉換日；還沒開帳 → null。 */
export function financeStartOf(c: StartColumns): FinanceStart | null {
  if (!c.financeOpenedAt || !c.financeConversionDate) return null;
  const dateKey = c.financeConversionDate.toISOString().slice(0, 10);
  return { dateKey, start: parseTaipeiDateRange(dateKey).start };
}

export async function financeStart(classroomId: number): Promise<FinanceStart | null> {
  const c = await prisma.classroom.findUnique({ where: { id: classroomId }, select: financeStartSelect });
  return c ? financeStartOf(c) : null;
}

/**
 * 「之前買的次數包」的購買日：一定落在任何轉換日之前，開帳時算成預付（不管之後改成哪一天）。
 * 開帳前記的也一樣——那時還不知道轉換日。
 */
export const BEFORE_CONVERSION_PURCHASED_AT = new Date("2000-01-01T00:00:00+08:00");
