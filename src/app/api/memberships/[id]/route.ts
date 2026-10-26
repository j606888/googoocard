import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { ApiError, badRequest } from "@/lib/apiError";
import { updateMembershipSchema } from "@/lib/schemas";
import { canLinkTeacher } from "@/lib/roles";
import {
  MODULES,
  effectivePermissions,
  isPermission,
  overridesFor,
  visiblePermissions,
} from "@/lib/permissions";
import { linkTeacher, unlinkTeacher } from "@/service/team";

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

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Change someone's role, permissions and/or which Teacher row they are.
 * `members.manage` only.
 *
 * The owner's role isn't changeable here (that's transfer-ownership), and
 * nobody changes their own role or permissions — an admin can't lock
 * themselves out by accident. Linking a teacher is allowed for anyone but a
 * 小幫手, including the caller (an admin who also teaches). A teacher always
 * ends up linked.
 *
 * Permissions arrive as the full list the member should have; only the
 * difference from the role's bundle is stored (grants/revokes). Changing the
 * role drops the old overrides. Nobody can hand out a permission they don't
 * hold themselves.
 */
export const PATCH = apiRoute<Params>(async ({ request, params, userId, classroomId, modules }) => {
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
  const roleChanged = role !== membership.role;

  // Overrides survive only while the role stays the same.
  let { grants, revokes } = roleChanged ? { grants: [] as string[], revokes: [] as string[] } : membership;
  if (body.permissions !== undefined) {
    const unknown = body.permissions.filter((p) => !isPermission(p));
    if (unknown.length > 0) {
      throw badRequest("UNKNOWN_PERMISSION", `Unknown permission: ${unknown.join(", ")}`);
    }
    // Only the checkboxes on screen (modules that are on) are rewritten.
    ({ grants, revokes } = overridesFor(
      role,
      body.permissions.filter(isPermission),
      visiblePermissions([...modules]),
      { grants, revokes }
    ));
  }
  const permissionsChanged =
    !sameSet(grants, membership.grants) || !sameSet(revokes, membership.revokes);

  if (permissionsChanged && !roleChanged) {
    if (membership.role === "owner") {
      throw new ApiError(403, "CANNOT_CHANGE_OWNER_PERMISSIONS", "The owner always has every permission");
    }
    if (membership.userId === userId) {
      throw new ApiError(403, "CANNOT_CHANGE_OWN_PERMISSIONS", "Ask another admin to change your permissions");
    }
  }
  if (permissionsChanged) {
    // Compared with every module on, so a permission can't be slipped in
    // while its module happens to be off.
    const caller = await prisma.membership.findFirstOrThrow({
      where: { userId, classroomId },
      select: { role: true, grants: true, revokes: true },
    });
    const all = { modules: MODULES };
    const callerHas = effectivePermissions({ ...caller, ...all });
    const before = effectivePermissions({ ...membership, ...all });
    const after = effectivePermissions({ role, grants, revokes, ...all });
    const handedOut = [...after].filter((p) => !before.has(p) && !callerHas.has(p));
    if (handedOut.length > 0) {
      throw new ApiError(403, "CANNOT_GRANT_PERMISSION", `You don't have: ${handedOut.join(", ")}`);
    }
  }

  const current = await prisma.teacher.findFirst({
    where: { classroomId, userId: membership.userId },
    select: { id: true },
  });
  let teacherId = body.teacherId !== undefined ? body.teacherId : (current?.id ?? null);
  if (!canLinkTeacher(role)) {
    if (body.teacherId) {
      throw badRequest("ASSISTANT_CANNOT_LINK_TEACHER", "A 小幫手 is not linked to a teacher");
    }
    teacherId = null;
  }
  if (role === "teacher" && teacherId === null) {
    throw badRequest("TEACHER_REQUIRED", "A teacher must be linked to a teacher profile");
  }

  await prisma.$transaction(async (tx) => {
    if (roleChanged || permissionsChanged) {
      await tx.membership.update({ where: { id: membership.id }, data: { role, grants, revokes } });
    }
    if (teacherId !== (current?.id ?? null)) {
      await linkTeacher(tx, classroomId, membership.userId, teacherId);
    }
  });

  return { success: true };
}, { permission: "members.manage" });

/**
 * Remove someone from the current classroom. `members.manage` only; never the owner.
 *
 * Takes effect on their very next request: `apiRoute` re-reads the membership
 * every time, so the cookie they're still holding stops working immediately.
 */
export const DELETE = apiRoute<Params>(async ({ params, userId, classroomId }) => {
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

  await prisma.$transaction([
    prisma.membership.delete({ where: { id: membership.id } }),
    // The Teacher row stays (old lessons keep it); it just stops being them.
    unlinkTeacher(prisma, classroomId, membership.userId),
    // Their next login would otherwise land them back in a classroom they're
    // no longer part of.
    prisma.user.updateMany({
      where: { id: membership.userId, currentClassroomId: classroomId },
      data: { currentClassroomId: null },
    }),
  ]);

  return { success: true };
}, { permission: "members.manage" });
