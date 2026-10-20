import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { ApiError, badRequest } from "@/lib/apiError";

type Params = { id: string };

/**
 * Hand the current classroom to one of its assistants. Owner only.
 *
 * The owner becomes an assistant (so they can then leave like anyone else) and
 * the target becomes owner; `Classroom.ownerId` moves with them. All three
 * writes are one transaction — a classroom must never have zero or two owners.
 *
 * This is also the owner's way out before deleting their account
 * (`DELETE /api/me` refuses while they still own a live classroom).
 */
export const POST = apiRoute<Params>(async ({ params, userId, classroomId, role }) => {
  if (role !== "owner") {
    throw new ApiError(403, "NOT_CLASSROOM_OWNER", "Only the classroom owner can transfer ownership");
  }

  const membershipId = parseId(params.id, "membership id");

  // Scoped to the caller's classroom — a membership id from elsewhere reads as
  // "doesn't exist", same as removing a member.
  const target = await prisma.membership.findFirst({
    where: { id: membershipId, classroomId },
  });
  if (!target) {
    throw new ApiError(404, "MEMBERSHIP_NOT_FOUND", "Membership not found");
  }
  if (target.userId === userId) {
    throw badRequest("ALREADY_OWNER", "You already own this classroom");
  }

  await prisma.$transaction([
    prisma.membership.update({ where: { id: target.id }, data: { role: "owner" } }),
    prisma.membership.updateMany({
      where: { userId, classroomId },
      data: { role: "assistant" },
    }),
    prisma.classroom.update({ where: { id: classroomId }, data: { ownerId: target.userId } }),
  ]);

  return { ok: true };
});
