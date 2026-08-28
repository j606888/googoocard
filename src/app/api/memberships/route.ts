import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";

export const GET = apiRoute(async ({ classroomId }) => {
  const memberships = await prisma.membership.findMany({
    where: { classroomId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      role: true,
      userId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return memberships;
});
