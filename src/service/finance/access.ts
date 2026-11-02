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

/** 財務已開，而且這個人有財務權限（Membership.isFinance）。 */
export async function assertFinance(userId: number, classroomId: number): Promise<void> {
  await assertFinanceEnabled(classroomId);
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { isFinance: true },
  });
  if (!m?.isFinance) {
    throw new ApiError(403, "NOT_FINANCE", "Only finance members can do this");
  }
}
