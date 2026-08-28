import prisma from "@/lib/prisma";

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
