import { Prisma, type InviteToken } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/apiError";
import { ASSIGNABLE_ROLES, canLinkTeacher, type AssignableRole } from "@/lib/roles";

type Db = Prisma.TransactionClient | typeof prisma;

export function isAssignableRole(role: unknown): role is AssignableRole {
  return typeof role === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/**
 * A teacher id an admin wants to link someone to: in this classroom and not
 * already somebody else's. `forUserId` is who it'll be linked to (null while
 * still an invite) — re-linking the same person is fine.
 */
export async function findLinkableTeacher(
  db: Db,
  classroomId: number,
  teacherId: number,
  forUserId: number | null
) {
  const teacher = await db.teacher.findFirst({
    where: { id: teacherId, classroomId },
    select: { id: true, userId: true, archivedAt: true },
  });
  if (!teacher) {
    throw badRequest("TEACHER_NOT_FOUND", "Teacher not found in this classroom");
  }
  if (teacher.userId !== null && teacher.userId !== forUserId) {
    throw new ApiError(409, "TEACHER_ALREADY_LINKED", "This teacher is already linked to another member");
  }
  return teacher;
}

/**
 * Point `userId`'s teacher profile in this classroom at `teacherId`, or drop it
 * with null. A user has at most one per classroom (`@@unique([classroomId, userId])`),
 * so any previous link is cleared first.
 */
export async function linkTeacher(
  tx: Prisma.TransactionClient,
  classroomId: number,
  userId: number,
  teacherId: number | null
) {
  if (teacherId !== null) {
    await findLinkableTeacher(tx, classroomId, teacherId, userId);
  }
  await tx.teacher.updateMany({
    where: { classroomId, userId, ...(teacherId !== null && { id: { not: teacherId } }) },
    data: { userId: null },
  });
  if (teacherId !== null) {
    await tx.teacher.update({ where: { id: teacherId }, data: { userId } });
  }
}

/** Members who leave or are removed stop being anyone's teacher; the teacher row stays. */
export function unlinkTeacher(db: Db, classroomId: number, userId: number) {
  return db.teacher.updateMany({ where: { classroomId, userId }, data: { userId: null } });
}

/**
 * Turn a validated invite into a membership: the invite's role, its teacher
 * link (skipped quietly if that teacher got linked to someone else since — the
 * joiner is still a teacher and an admin can link them later), one use spent.
 */
export async function redeemInvite(
  tx: Prisma.TransactionClient,
  userId: number,
  invite: Pick<InviteToken, "id" | "classroomId" | "role" | "teacherId">
) {
  const role = isAssignableRole(invite.role) ? invite.role : "assistant";
  await tx.inviteToken.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
  await tx.membership.create({ data: { userId, classroomId: invite.classroomId, role } });
  if (invite.teacherId !== null && canLinkTeacher(role)) {
    await tx.teacher.updateMany({
      where: { id: invite.teacherId, classroomId: invite.classroomId, userId: null },
      data: { userId },
    });
  }
}
