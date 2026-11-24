import { z } from "zod";
import prisma from "@/lib/prisma";
import { findLessonInClassroom } from "@/lib/authz";
import { refreshLesson } from "@/service/lesson";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { ApiError } from "@/lib/apiError";
import { periodTimesSchema } from "@/lib/schemas";
import { exceedsTermSessions } from "@/lib/termEnrollment";

// One period ({ startTime, endTime }) or several at once ({ periods: [...] },
// the list's "一次排 4 週").
const createPeriodsSchema = z.union([
  z.object({ periods: z.array(periodTimesSchema).min(1).max(12) }),
  periodTimesSchema.transform((period) => ({ periods: [period] })),
]);

export const POST = apiRoute<{ id: string }>(async ({ request, params, classroomId }) => {
  const lessonId = parseId(params.id, "lesson id");
  if (!(await findLessonInClassroom(lessonId, classroomId))) {
    throw new ApiError(404, "NOT_FOUND", "Lesson not found");
  }
  const { periods } = await parseBody(request, createPeriodsSchema);

  // 報名整期的課：時段數不能超過整期堂數（停課就刪掉那堂再補排）。
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { termSessions: true, _count: { select: { periods: true } } },
  });
  if (lesson && exceedsTermSessions(lesson._count.periods + periods.length, lesson.termSessions)) {
    throw new ApiError(400, "TERM_SESSIONS_EXCEEDED", `整期 ${lesson.termSessions} 堂，已經排了 ${lesson._count.periods} 堂`);
  }

  await prisma.$transaction([
    prisma.lessonPeriod.createMany({
      data: periods.map(({ startTime, endTime }) => ({ lessonId, startTime, endTime })),
    }),
    // Scheduling a lesson that was ended by hand reopens it.
    prisma.lesson.update({ where: { id: lessonId }, data: { endedAt: null } }),
  ]);

  await refreshLesson(lessonId);

  return { success: true };
});
