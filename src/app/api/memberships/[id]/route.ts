import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { ApiError, badRequest } from "@/lib/apiError";

type Params = { id: string };

/**
 * Remove someone from the current classroom. Owner only.
 *
 * Takes effect on their very next request: `apiRoute` re-reads the membership
 * every time, so the cookie they're still holding stops working immediately.
 */
export const DELETE = apiRoute<Params>(async ({ params, userId, classroomId, role }) => {
  if (role !== "owner") {
    throw new ApiError(403, "NOT_CLASSROOM_OWNER", "Only the classroom owner can remove members");
  }

  const membershipId = parseId(params.id, "membership id");

  // Scoped to the caller's classroom — a membership id from somewhere else must
  // read as "doesn't exist", not as a permission error.
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, classroomId },
  });
  if (!membership) {
    throw new ApiError(404, "MEMBERSHIP_NOT_FOUND", "Membership not found");
  }

  if (membership.userId === userId) {
    throw badRequest(
      "CANNOT_REMOVE_SELF",
      "Delete the classroom instead of removing yourself from it"
    );
  }
  if (membership.role === "owner") {
    throw new ApiError(403, "CANNOT_REMOVE_OWNER", "The classroom owner cannot be removed");
  }

  await prisma.$transaction([
    prisma.membership.delete({ where: { id: membership.id } }),
    // Their next login would otherwise land them back in a classroom they're
    // no longer part of.
    prisma.user.updateMany({
      where: { id: membership.userId, currentClassroomId: classroomId },
      data: { currentClassroomId: null },
    }),
  ]);

  return { success: true };
});
