import prisma from "@/lib/prisma";
import { createAuthSession } from "@/lib/auth";
import { sessionRoute, parseId } from "@/lib/apiRoute";
import { requireMembership } from "@/lib/authz";

type Params = { id: string };

export const POST = sessionRoute<Params>(async ({ params, userId }) => {
  const classroomId = parseId(params.id, "classroom id");
  // 404s for a classroom the caller isn't in, and for an archived one.
  await requireMembership(userId, classroomId);

  await prisma.user.update({
    where: { id: userId },
    data: { currentClassroomId: classroomId },
  });
  await createAuthSession(userId, classroomId);

  return { message: "Classroom switched successfully" };
});
