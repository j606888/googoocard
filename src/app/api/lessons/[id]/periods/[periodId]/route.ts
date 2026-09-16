import prisma from "@/lib/prisma";
import { findLessonInClassroom } from "@/lib/authz";
import { refreshLesson } from "@/service/lesson";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { ApiError } from "@/lib/apiError";
import { periodTimesSchema } from "@/lib/schemas";

type Params = { id: string; periodId: string };

/** Both handlers scope by lesson → classroom, so a period id alone never reaches Prisma. */
const requireLesson = async (rawId: string, classroomId: number) => {
  const lessonId = parseId(rawId, "lesson id");
  if (!(await findLessonInClassroom(lessonId, classroomId))) {
    throw new ApiError(404, "NOT_FOUND", "Lesson not found");
  }
  return lessonId;
};

export const DELETE = apiRoute<Params>(async ({ params, classroomId }) => {
  const lessonId = await requireLesson(params.id, classroomId);
  const periodId = parseId(params.periodId, "period id");

  await prisma.lessonPeriod.delete({
    where: { id: periodId, lessonId },
  });

  await refreshLesson(lessonId);

  return { success: true };
});

/**
 * Re-date a period. See docs/roadmap.md P2-2 — a rained-off class whose period
 * stays on the calendar drags every later 點名 onto the wrong day, and until now
 * the only repair was delete-and-recreate, which loses the attendance.
 *
 * **Attendance rides along on purpose.** `AttendanceRecord` points at the period
 * by id, so moving the period moves its records with it, and card deductions are
 * untouched — the records' content was never wrong, only the day they hung on.
 * That is exactly what the one-off Bailamore fix did by hand, so a period that
 * has already been checked can still be moved.
 */
export const PATCH = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const lessonId = await requireLesson(params.id, classroomId);
  const periodId = parseId(params.periodId, "period id");
  const { startTime, endTime } = await parseBody(request, periodTimesSchema);

  await prisma.lessonPeriod.update({
    where: { id: periodId, lessonId },
    data: { startTime, endTime },
  });

  // endAt / status are derived from the periods, so they move too.
  await refreshLesson(lessonId);

  return { success: true };
});
