import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/authz";
import { addMonthsTaipei, parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";

export const CARD_EXPIRY_MONTHS = 6;

export async function assertClassroomMember(userId: number, classroomId: number) {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { id: true },
  });
  if (!m) throw new ApiError(400, "NOT_A_MEMBER", "User is not a member of this classroom");
}

/** 開帳：只有 owner。launchDate 為台北日期 YYYY-MM-DD。 */
export async function enableFinance(args: {
  classroomId: number;
  userId: number;
  launchDate: string;
  legacyCustodianUserId: number;
}) {
  const { classroomId, userId, launchDate, legacyCustodianUserId } = args;
  await requireOwner(userId, classroomId);
  await assertClassroomMember(legacyCustodianUserId, classroomId);

  const launch = parseTaipeiDateRange(launchDate).start;
  const expiresAt = addMonthsTaipei(launchDate, CARD_EXPIRY_MONTHS);

  await prisma.$transaction(async (tx) => {
    // 條件式更新：同時按兩次也只有一次成功。
    const claimed = await tx.classroom.updateMany({
      where: { id: classroomId, financeEnabledAt: null },
      data: { financeEnabledAt: launch, legacyCustodianUserId },
    });
    if (claimed.count === 0) {
      throw new ApiError(409, "FINANCE_ALREADY_ENABLED", "Finance is already enabled");
    }
    await tx.membership.update({
      where: { userId_classroomId: { userId, classroomId } },
      data: { isFinance: true },
    });
    await tx.studentCard.updateMany({
      where: { student: { classroomId }, expiredAt: null, remainingSessions: { gt: 0 } },
      data: { expiresAt },
    });
  });

  return { launchDate: toTaipeiDateKey(launch), expiresAt };
}
