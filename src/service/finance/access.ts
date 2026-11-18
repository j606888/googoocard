import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { isAdminRole } from "@/lib/roles";

/** 改分帳規則、勾結清、改卡的分部、記轉帳：管理員＋分部負責人（docs/finance-lite.md §9）。 */
export async function canManageFinance(classroomId: number, userId: number, role: string) {
  if (isAdminRole(role)) return true;
  const kept = await prisma.location.count({ where: { classroomId, keeperUserId: userId } });
  return kept > 0;
}

export async function assertCanManageFinance(classroomId: number, userId: number, role: string) {
  if (!(await canManageFinance(classroomId, userId, role))) {
    throw new ApiError(403, "FINANCE_FORBIDDEN", "Only admins and branch keepers can do this");
  }
}
