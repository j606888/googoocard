import { apiRoute } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { findLessonInClassroom } from "@/lib/authz";
import { getLessonPeriodStats } from "@/service/lessonStats";

/** 這一期頁：每個已點名時段的人數與收入、整期收入。 */
export const GET = apiRoute<{ id: string }>(async ({ params, classroomId }) => {
  const lesson = await findLessonInClassroom(Number(params.id), classroomId);
  if (!lesson) throw notFound("Lesson");
  return getLessonPeriodStats(lesson.id);
});
