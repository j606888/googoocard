import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { isAdminRole } from "@/lib/roles";
import { canManageFinance } from "@/service/finance/access";

/** 財務設定：分部（負責人、轉換日）、成員名單、這個人能不能管財務。 */
export const GET = apiRoute(async ({ classroomId, userId, role }) => {
  const [locations, memberships] = await Promise.all([
    prisma.location.findMany({
      where: { classroomId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, archivedAt: true, keeperUserId: true, financeStartAt: true },
    }),
    prisma.membership.findMany({
      where: { classroomId },
      select: { userId: true, role: true, user: { select: { name: true } } },
      orderBy: { id: "asc" },
    }),
  ]);
  return {
    enabled: locations.some((l) => l.financeStartAt !== null),
    canManage: await canManageFinance(classroomId, userId, role),
    isAdmin: isAdminRole(role),
    me: userId,
    locations,
    members: memberships.map((m) => ({ userId: m.userId, name: m.user.name, role: m.role })),
  };
});
