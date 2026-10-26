import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";

export const GET = apiRoute(async ({ classroomId }) => {
  const [memberships, linked] = await Promise.all([
    prisma.membership.findMany({
      where: { classroomId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        userId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.teacher.findMany({
      where: { classroomId, userId: { not: null } },
      select: { id: true, name: true, color: true, userId: true },
    }),
  ]);

  const teacherByUser = new Map(linked.map(({ userId, ...teacher }) => [userId, teacher]));
  return memberships.map((membership) => ({
    ...membership,
    teacher: teacherByUser.get(membership.userId) ?? null,
  }));
});
