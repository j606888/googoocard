import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { ApiError, badRequest } from "@/lib/apiError";
import { assertAdmin } from "@/lib/authz";
import { updateMembershipSchema } from "@/lib/schemas";
import { ensurePerson, linkTeacher, unlinkTeacher } from "@/service/team";

type Params = { id: string };

// Scoped to the caller's classroom — a membership id from somewhere else must
// read as "doesn't exist", not as a permission error.
async function findMembershipInClassroom(rawId: string, classroomId: number) {
  const membership = await prisma.membership.findFirst({
    where: { id: parseId(rawId, "membership id"), classroomId },
  });
  if (!membership) {
    throw new ApiError(404, "MEMBERSHIP_NOT_FOUND", "Membership not found");
  }
  return membership;
}

/**
 * Change someone's role and/or which person record they are. 管理員 only.
 *
 * The owner's role isn't changeable here (that's transfer-ownership), and
 * nobody changes their own role — an admin can't lock themselves out by
 * accident. Re-linking to another person (the roster already had them before
 * they joined) is allowed for every member, the caller included; unlinking
 * isn't — every member is exactly one person. The record they leave behind
 * is archived if it never had a lesson.
 */
export const PATCH = apiRoute<Params>(async ({ request, params, userId, classroomId, role: callerRole }) => {
  assertAdmin(callerRole);
  const body = await parseBody(request, updateMembershipSchema);
  const membership = await findMembershipInClassroom(params.id, classroomId);

  if (body.role !== undefined && body.role !== membership.role) {
    if (membership.role === "owner") {
      throw new ApiError(403, "CANNOT_CHANGE_OWNER_ROLE", "Transfer the classroom to change the owner's role");
    }
    if (membership.userId === userId) {
      throw new ApiError(403, "CANNOT_CHANGE_OWN_ROLE", "Ask another admin to change your role");
    }
  }

  const role = body.role ?? membership.role;
  const current = await prisma.teacher.findFirst({
    where: { classroomId, userId: membership.userId },
    select: { id: true },
  });
  if (body.teacherId === null) {
    throw badRequest("PERSON_REQUIRED", "Every member is linked to a person record");
  }
  const teacherId = body.teacherId ?? current?.id ?? null;

  await prisma.$transaction(async (tx) => {
    if (role !== membership.role) {
      await tx.membership.update({ where: { id: membership.id }, data: { role } });
    }
    if (teacherId !== null && teacherId !== (current?.id ?? null)) {
      await linkTeacher(tx, classroomId, membership.userId, teacherId);
    }
    // 補建前就加入、還沒有人員資料的成員（遷移前的資料）。
    if (teacherId === null) await ensurePerson(tx, classroomId, membership.userId, role);
  });

  return { success: true };
});

/**
 * Remove someone from the current classroom. 管理員 only; never the owner.
 *
 * Takes effect on their very next request: `apiRoute` re-reads the membership
 * every time, so the cookie they're still holding stops working immediately.
 */
export const DELETE = apiRoute<Params>(async ({ params, userId, classroomId, role }) => {
  assertAdmin(role);
  const membership = await findMembershipInClassroom(params.id, classroomId);

  if (membership.userId === userId) {
    throw badRequest(
      "CANNOT_REMOVE_SELF",
      "Delete the classroom instead of removing yourself from it"
    );
  }
  if (membership.role === "owner") {
    throw new ApiError(403, "CANNOT_REMOVE_OWNER", "The classroom owner cannot be removed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: membership.id } });
    // The person record stays (old lessons keep it); it just stops being them.
    await unlinkTeacher(tx, classroomId, membership.userId);
    // Their next login would otherwise land them back in a classroom they're
    // no longer part of.
    await tx.user.updateMany({
      where: { id: membership.userId, currentClassroomId: classroomId },
      data: { currentClassroomId: null },
    });
  });

  return { success: true };
});
