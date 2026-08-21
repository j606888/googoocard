import prisma from "@/lib/prisma";

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
