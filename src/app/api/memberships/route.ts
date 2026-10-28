import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { effectivePermissions, roleBundle, visiblePermissions } from "@/lib/permissions";

export const GET = apiRoute(async ({ classroomId, modules }) => {
  const [memberships, linked] = await Promise.all([
    prisma.membership.findMany({
      where: { classroomId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        userId: true,
        grants: true,
        revokes: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.teacher.findMany({
      where: { classroomId, userId: { not: null } },
      select: { id: true, name: true, color: true, userId: true },
    }),
  ]);

  const teacherByUser = new Map(linked.map(({ userId, ...teacher }) => [userId, teacher]));
  const enabled = [...modules];
  const visible = visiblePermissions(enabled);
  return memberships.map(({ grants, revokes, ...membership }) => {
    const permissions = effectivePermissions({ role: membership.role, grants, revokes, modules: enabled });
    const bundle = roleBundle(membership.role);
    return {
      ...membership,
      teacher: teacherByUser.get(membership.userId) ?? null,
      permissions: [...permissions],
      // Differs from the role's defaults on a checkbox that's on screen.
      customized: visible.some((p) => permissions.has(p) !== bundle.has(p)),
    };
  });
});
