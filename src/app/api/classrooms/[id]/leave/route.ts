import prisma from "@/lib/prisma";
import { sessionRoute, parseId } from "@/lib/apiRoute";
import { requireMembership } from "@/lib/authz";
import { ApiError } from "@/lib/apiError";
import { resolveNextClassroom } from "@/service/classroom";

type Params = { id: string };

/**
 * Leave a classroom you were invited into.
 *
 * The owner can't use this — the classroom would be left without one, and
 * `Classroom.ownerId` would still point at someone who is no longer a member.
 * They archive it instead (`DELETE /api/classrooms/[id]`); transferring
 * ownership is backlog.
 */
export const POST = sessionRoute<Params>(async ({ params, userId }) => {
  const classroomId = parseId(params.id, "classroom id");
  const membership = await requireMembership(userId, classroomId);

  if (membership.role === "owner") {
    throw new ApiError(
      403,
      "OWNER_CANNOT_LEAVE",
      "The classroom owner cannot leave; delete the classroom instead"
    );
  }

  await prisma.membership.delete({ where: { id: membership.id } });

  const nextClassroomId = await resolveNextClassroom(userId);

  return { nextClassroomId };
});
