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
