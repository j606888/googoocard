import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { allTeachersInClassroom, findLessonInClassroom } from "@/lib/authz";
import { revenueSplitSchema } from "@/lib/revenueSplit";

type Params = { id: string };

// 每堂分潤規則（src/lib/revenueSplit.ts）：整組換掉；body 為 null = 清掉。
export const PUT = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const lesson = await findLessonInClassroom(parseId(params.id, "lesson id"), classroomId);
  if (!lesson) throw new ApiError(404, "LESSON_NOT_FOUND", "Lesson not found");
  const body = await parseBody(request, revenueSplitSchema.nullable());
  if (body) {
    const teacherIds = body.steps.flatMap((s) => (s.teacherId === null ? [] : [s.teacherId]));
    if (teacherIds.length > 0 && !(await allTeachersInClassroom(teacherIds, classroomId))) {
      throw new ApiError(400, "INVALID_TEACHER", "Invalid teacher");
    }
  }
  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: { revenueSplit: body ?? Prisma.DbNull },
    select: { id: true, revenueSplit: true },
  });
  return updated;
});
