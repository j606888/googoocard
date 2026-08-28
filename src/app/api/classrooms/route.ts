import prisma from "@/lib/prisma";
import { createAuthSession, decodeAuthToken } from "@/lib/auth";
import { sessionRoute, parseBody } from "@/lib/apiRoute";
import { createClassroomSchema } from "@/lib/schemas";

/**
 * List the caller's classrooms. `sessionRoute`, not `apiRoute`: this is the
 * recovery path after leaving or deleting a classroom, so it has to answer even
 * when the JWT's `classroomId` no longer resolves to a live membership.
 */
export const GET = sessionRoute(async ({ userId }) => {
  const { classroomId } = await decodeAuthToken();

  const memberships = await prisma.membership.findMany({
    where: { userId, classroom: { deletedAt: null } },
    orderBy: { id: "asc" },
    // Never `include: { classroom: true }` — that ships `Classroom.checkinKey`,
    // the walk-in QR self check-in key for the whole classroom (docs/roadmap.md
    // P0-2). Whitelist the fields instead.
    select: {
      role: true,
      classroom: { select: { id: true, name: true } },
    },
  });

  const classrooms = memberships.map(({ classroom, role }) => ({ ...classroom, role }));

  // The JWT can outlive the membership it names. Only report a current
  // classroom that's actually still in the list, so the UI falls through to
  // onboarding instead of rendering a classroom the user can no longer enter.
  const currentClassroomId = classrooms.some((c) => c.id === classroomId)
    ? classroomId!
    : null;

  return { classrooms, currentClassroomId };
});

export const POST = sessionRoute(async ({ request, userId }) => {
  const { name } = await parseBody(request, createClassroomSchema);

  const classroom = await prisma.$transaction(async (tx) => {
    const created = await tx.classroom.create({
      data: { name, ownerId: userId },
    });

    await tx.membership.create({
      data: { userId, classroomId: created.id, role: "owner" },
    });

    return created;
  });

  await createAuthSession(userId, classroom.id);
  await prisma.user.update({
    where: { id: userId },
    data: { currentClassroomId: classroom.id },
  });

  return { success: true, classroom: { id: classroom.id, name: classroom.name } };
});
