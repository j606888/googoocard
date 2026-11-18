import { z } from "zod";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { findLessonInClassroom } from "@/lib/authz";
import { assertCanManageFinance } from "@/service/finance/access";
import { setPeriodOverride } from "@/service/finance/rules";

/** 單堂覆寫：rule = null 拿掉覆寫、回到整門課的規則。 */
export const PUT = apiRoute<{ id: string; periodId: string }>(async ({ request, params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const lessonId = parseId(params.id, "lesson id");
  if (!(await findLessonInClassroom(lessonId, classroomId))) throw notFound("Lesson");
  const periodId = parseId(params.periodId, "period id");
  const { rule } = await parseBody(request, z.object({ rule: z.unknown() }));
  return { rule: await setPeriodOverride(classroomId, lessonId, periodId, rule ?? null, userId) };
});
