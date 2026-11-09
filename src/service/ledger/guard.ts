// 財務 v2 寫入共用的檢查：日期不能落在鎖帳日（含）以前或轉換日之前；權限。
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { dateKeyOfDbDate } from "./load";
import { financeStartOf } from "@/service/finance/start";

export const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
export const todayKey = () => toTaipeiDateKey(new Date());
export const dbDate = (d: string) => new Date(`${d}T00:00:00Z`);

export async function ledgerDates(classroomId: number) {
  const c = await prisma.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    select: { financeEnabledAt: true, financeConversionDate: true, financeLockDate: true, financeOpenedAt: true, financeRoundTo: true },
  });
  if (!c.financeEnabledAt) throw new ApiError(404, "FINANCE_DISABLED", "Finance is not enabled for this classroom");
  return {
    /** 還沒開帳 → null（財務還沒開始，service/finance/start.ts）。 */
    conversionDate: financeStartOf(c)?.dateKey ?? null,
    lockDate: c.financeLockDate ? dateKeyOfDbDate(c.financeLockDate) : null,
    opened: c.financeOpenedAt !== null,
    roundTo: c.financeRoundTo,
  };
}

/** 新記的一筆，日期必須在轉換日（含）之後、鎖帳日之後。還沒開帳 → 不檢查轉換日（開帳時才知道哪些算進帳）。 */
export async function assertWritableDate(classroomId: number, date: string) {
  const d = await ledgerDates(classroomId);
  if (d.lockDate && date <= d.lockDate) throw new ApiError(409, "PERIOD_LOCKED", `The ledger is locked through ${d.lockDate}`);
  if (d.conversionDate !== null && date < d.conversionDate) throw new ApiError(400, "BEFORE_CONVERSION", `Date is before the conversion date ${d.conversionDate}`);
  return d;
}

export async function membershipOf(userId: number, classroomId: number) {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { role: true, canSettle: true, isCustodian: true },
  });
  return { role: m?.role ?? null, canSettle: !!m?.canSettle, isCustodian: !!m?.isCustodian };
}

/** 可以結算的人，或這個資金帳戶的保管人。 */
export async function assertSettleOrHolder(userId: number, classroomId: number, moneyAccountId: number | null) {
  const m = await membershipOf(userId, classroomId);
  if (m.canSettle) return;
  if (moneyAccountId !== null) {
    const ma = await prisma.moneyAccount.findFirst({ where: { id: moneyAccountId, classroomId }, select: { holderUserId: true } });
    if (ma?.holderUserId === userId) return;
  }
  throw new ApiError(403, "NOT_FINANCE", "Only members who can settle, or the holder of this money account, can do this");
}

export async function findMoneyAccount(classroomId: number, id: number) {
  const ma = await prisma.moneyAccount.findFirst({
    where: { id, classroomId },
    select: { id: true, holderUserId: true, locationId: true, accountId: true, archivedAt: true, name: true },
  });
  if (!ma) throw new ApiError(400, "INVALID_MONEY_ACCOUNT", "Money account not found");
  return ma;
}
