import prisma from "@/lib/prisma";
import { sessionRoute, parseId } from "@/lib/apiRoute";
import { requireMembership } from "@/lib/authz";
import { ApiError } from "@/lib/apiError";
import { resolveNextClassroom } from "@/service/classroom";
import { unlinkTeacher } from "@/service/team";

type Params = { id: string };

/**
 * Leave a classroom you were invited into.
 *
 * The owner can't use this — the classroom would be left without one, and
 * `Classroom.ownerId` would still point at someone who is no longer a member.
 * They hand it to another member first (`POST /api/memberships/[id]/transfer-ownership`)
 * or archive it (`DELETE /api/classrooms/[id]`).
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

  await prisma.$transaction([
    prisma.membership.delete({ where: { id: membership.id } }),
    // The Teacher row stays (old lessons keep it); it just stops being them.
    unlinkTeacher(prisma, classroomId, userId),
  ]);

  const nextClassroomId = await resolveNextClassroom(userId);

  return { nextClassroomId };
});
