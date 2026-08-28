import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";

/**
 * The classroom id `decodeAuthToken` reports when the caller has no live
 * classroom — no session at all, or a JWT naming a classroom they've left,
 * been removed from, or that's been archived.
 *
 * Deliberately a real number rather than `undefined`. Most handlers still scope
 * with a bare `where: { classroomId }`, and Prisma reads `undefined` as "no
 * filter at all" — so an absent classroom id used to *widen* the query to every
 * classroom in the database instead of narrowing it to none. `-1` can never
 * match a row (Postgres identity sequences start at 1), so those handlers fail
 * closed. Handlers wrapped in `apiRoute` never see it: they answer 401.
 *
 * It lives here rather than in `@/lib/auth` so that tests, which replace that
 * whole module with a `vi.mock` factory, don't have to re-declare it.
 */
export const NO_CLASSROOM = -1;

// Classroom-scoping guards. The middleware only proves a valid JWT — it does
// NOT scope to a classroom. API handlers that fetch/mutate a resource by a
// caller-controlled integer id must verify the resource belongs to the
// caller's current classroom, or they expose a cross-classroom IDOR.
//
// These return the row when it belongs to the classroom, or null — callers
// respond 404 (not 403) so we don't leak the existence of other classrooms'
// resources.

export async function findLessonInClassroom(
  lessonId: number,
  classroomId: number | null | undefined
) {
  if (!classroomId || Number.isNaN(lessonId)) return null;
  return prisma.lesson.findFirst({ where: { id: lessonId, classroomId } });
}

export async function findStudentInClassroom(
  studentId: number,
  classroomId: number | null | undefined
) {
  if (!classroomId || Number.isNaN(studentId)) return null;
  return prisma.student.findFirst({ where: { id: studentId, classroomId } });
}

export async function findLessonGroupInClassroom(
  groupId: number,
  classroomId: number | null | undefined
) {
  if (!classroomId || Number.isNaN(groupId)) return null;
  return prisma.lessonGroup.findFirst({ where: { id: groupId, classroomId } });
}

// ---------------------------------------------------------------------------
// Membership guards.
//
// The JWT carries `classroomId`, so on its own it says nothing about whether
// the caller is *still* a member: leaving, being removed, or the classroom
// being archived would all take up to 30 days to take effect. Every guard here
// re-reads the Membership row and joins on `classroom.deletedAt = null`, which
// is what makes those three actions immediate.
//
// A non-member gets 404, not 403 — same reasoning as the finders above: don't
// confirm that someone else's classroom id exists.

export async function findMembership(
  userId: number | null | undefined,
  classroomId: number | null | undefined
) {
  if (!userId || !classroomId) return null;
  return prisma.membership.findFirst({
    where: { userId, classroomId, classroom: { deletedAt: null } },
  });
}

export async function requireMembership(userId: number, classroomId: number) {
  const membership = await findMembership(userId, classroomId);
  if (!membership) {
    throw new ApiError(404, "CLASSROOM_NOT_FOUND", "Classroom not found");
  }
  return membership;
}

/** Destructive classroom-level actions (delete, remove a member) are owner-only. */
export async function requireOwner(userId: number, classroomId: number) {
  const membership = await requireMembership(userId, classroomId);
  if (membership.role !== "owner") {
    throw new ApiError(403, "NOT_CLASSROOM_OWNER", "Only the classroom owner can do this");
  }
  return membership;
}
