import prisma from "@/lib/prisma";
import { sessionRoute, parseId } from "@/lib/apiRoute";
import { requireOwner } from "@/lib/authz";
import { resolveNextClassroom } from "@/service/classroom";

type Params = { id: string };

/**
 * Owner-only classroom summary, used by the delete confirmation to spell out
 * what is about to be archived.
 */
export const GET = sessionRoute<Params>(async ({ params, userId }) => {
  const classroomId = parseId(params.id, "classroom id");
  await requireOwner(userId, classroomId);

  const [classroom, students, lessons, studentCards] = await Promise.all([
    prisma.classroom.findUniqueOrThrow({
      where: { id: classroomId },
      select: { id: true, name: true },
    }),
    prisma.student.count({ where: { classroomId } }),
    prisma.lesson.count({ where: { classroomId } }),
    prisma.studentCard.count({ where: { student: { classroomId } } }),
  ]);

  return { ...classroom, counts: { students, lessons, studentCards } };
});

/**
 * Archive a classroom (soft delete). Owner only.
 *
 * Nothing is actually removed: the domain has no `onDelete: Cascade` anywhere,
 * so a hard delete would mean unwinding ~16 tables and would destroy real
 * revenue and attendance history. `deletedAt` makes the classroom unreachable —
 * it drops out of the switcher, `switch` refuses it, and `apiRoute`'s
 * membership check (which joins on `deletedAt IS NULL`) locks every member out
 * of it immediately, stale JWT or not. Restoring is a manual `deletedAt = NULL`.
 *
 * Memberships are deliberately kept so a restore brings the team back with it.
 */
export const DELETE = sessionRoute<Params>(async ({ params, userId }) => {
  const classroomId = parseId(params.id, "classroom id");
  // 404s if the caller isn't a member or the classroom is already archived.
  await requireOwner(userId, classroomId);

  await prisma.$transaction([
    prisma.classroom.update({
      where: { id: classroomId },
      // Releasing `checkinKey` kills the QR poster on the studio wall the
      // moment the classroom is archived, and frees the unique value.
      data: { deletedAt: new Date(), checkinKey: null },
    }),
    prisma.user.updateMany({
      where: { currentClassroomId: classroomId },
      data: { currentClassroomId: null },
    }),
  ]);

  const nextClassroomId = await resolveNextClassroom(userId);

  return { nextClassroomId };
});
