import prisma from "@/lib/prisma";
import { createAuthSession } from "@/lib/auth";

export const joinClassroom = async ({
  userId,
  token,
}: {
  userId: number;
  token: string;
}): Promise<number | null> => {
  const inviteToken = await prisma.inviteToken.findUnique({
    where: {
      token,
    },
  });

  if (!inviteToken) return null;

  if (inviteToken.uses >= inviteToken.maxUses) return null;

  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId,
      classroomId: inviteToken.classroomId,
    },
  });

  if (existingMembership) return null;

  // `deletedAt` guard: an invite link minted before the classroom was archived
  // would otherwise still hand out memberships to a classroom nobody can enter.
  const classroom = await prisma.classroom.findFirst({
    where: {
      id: inviteToken.classroomId,
      deletedAt: null,
    },
  });

  if (!classroom) return null;

  await prisma.membership.create({
    data: {
      userId,
      classroomId: inviteToken.classroomId,
      role: "assistant",
    },
  });

  await prisma.inviteToken.update({
    where: {
      token,
    },
    data: {
      uses: {
        increment: 1,
      },
    },
  });

  return classroom.id;
};

/**
 * Move the user to whichever classroom they still have, after leaving or
 * deleting one: updates `User.currentClassroomId` **and** re-issues the auth
 * cookie, because the JWT carries `classroomId` and a stale one would keep
 * pointing at the classroom they just left.
 *
 * Returns the new classroom id, or null when they have none left — the caller
 * uses that to decide between `/lessons` and `/onboarding`.
 */
export const resolveNextClassroom = async (userId: number): Promise<number | null> => {
  const next = await prisma.membership.findFirst({
    where: { userId, classroom: { deletedAt: null } },
    orderBy: { id: "asc" },
    select: { classroomId: true },
  });

  const nextClassroomId = next?.classroomId ?? null;

  await prisma.user.update({
    where: { id: userId },
    data: { currentClassroomId: nextClassroomId },
  });
  await createAuthSession(userId, nextClassroomId ?? undefined);

  return nextClassroomId;
};
