import prisma from "@/lib/prisma";
import { findLessonInClassroom } from "@/lib/authz";
import { refreshLesson } from "@/service/lesson";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { ApiError } from "@/lib/apiError";

type Params = { id: string };

const requireLesson = async (rawId: string, classroomId: number) => {
  const lessonId = parseId(rawId, "lesson id");
  if (!(await findLessonInClassroom(lessonId, classroomId))) {
    throw new ApiError(404, "NOT_FOUND", "Lesson not found");
  }
  return lessonId;
};

/** End a lesson by hand — how an "ongoing" lesson reaches 已結束. */
export const POST = apiRoute<Params>(async ({ params, classroomId }) => {
  const lessonId = await requireLesson(params.id, classroomId);
  await prisma.lesson.update({ where: { id: lessonId }, data: { endedAt: new Date() } });
  await refreshLesson(lessonId);
  return { success: true };
});

/** Reopen: status falls back to the kind's own rule. */
export const DELETE = apiRoute<Params>(async ({ params, classroomId }) => {
  const lessonId = await requireLesson(params.id, classroomId);
  await prisma.lesson.update({ where: { id: lessonId }, data: { endedAt: null } });
  await refreshLesson(lessonId);
  return { success: true };
});
