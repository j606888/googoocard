import prisma from "@/lib/prisma";

/** A member's role plus what's needed to work out their permissions (src/lib/permissions.ts). */
export type MembershipAccess = {
  role: string;
  grants: string[];
  revokes: string[];
  /** Modules switched on in this classroom (`ClassroomModule`). */
  modules: string[];
};

/**
 * The one membership lookup `decodeAuthToken` runs on every request — role,
 * personal permission overrides and the classroom's modules in a single query.
 * Null when the user isn't a member, or the classroom is archived.
 *
 * Lives outside `@/lib/auth` so tests that mock that module can still build a
 * real session from the database (see tests/api/permissions.test.ts).
 */
export async function findMembershipAccess(
  userId: number,
  classroomId: number
): Promise<MembershipAccess | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId, classroomId, classroom: { deletedAt: null } },
    select: {
      role: true,
      grants: true,
      revokes: true,
      classroom: { select: { modules: { select: { module: true } } } },
    },
  });
  if (!membership) return null;
  const { classroom, ...rest } = membership;
  return { ...rest, modules: classroom.modules.map((m) => m.module) };
}
