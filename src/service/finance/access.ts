import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";

/** 財務只對 financeEnabledAt != null 的教室生效；沒開 → 404 FINANCE_DISABLED。 */
export async function assertFinanceEnabled(classroomId: number): Promise<{
  financeEnabledAt: Date;
  financeRoundTo: number;
  legacyCustodianUserId: number | null;
}> {
  const c = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { financeEnabledAt: true, financeRoundTo: true, legacyCustodianUserId: true },
  });
  if (!c || !c.financeEnabledAt) {
    throw new ApiError(404, "FINANCE_DISABLED", "Finance is not enabled for this classroom");
  }
  return {
    financeEnabledAt: c.financeEnabledAt,
    financeRoundTo: c.financeRoundTo,
    legacyCustodianUserId: c.legacyCustodianUserId,
  };
}

export async function isFinanceEnabled(classroomId: number): Promise<boolean> {
  const c = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { financeEnabledAt: true },
  });
  return !!c?.financeEnabledAt;
}

/** 財務已開，而且這個人「可以結算」（Membership.canSettle）：結算、記支出／次數包、改分帳與財務設定、開帳。 */
export async function assertCanSettle(userId: number, classroomId: number): Promise<void> {
  await assertFinanceEnabled(classroomId);
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { canSettle: true },
  });
  if (!m?.canSettle) {
    throw new ApiError(403, "NOT_FINANCE", "Only members who can settle can do this");
  }
}

/**
 * 記支出／次數包：可以結算的人記任何人付的；保管人只能記自己付的（付款人＝自己）。否則 403 NOT_FINANCE。
 * （付款人本身必須是保管人，由呼叫端另外驗。）
 */
export async function assertCanRecordPayment(
  userId: number,
  classroomId: number,
  payerUserId: number,
): Promise<void> {
  await assertFinanceEnabled(classroomId);
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { canSettle: true, isCustodian: true },
  });
  if (m?.canSettle) return;
  if (m?.isCustodian && payerUserId === userId) return;
  throw new ApiError(403, "NOT_FINANCE", "Custodians can only record what they paid themselves");
}
