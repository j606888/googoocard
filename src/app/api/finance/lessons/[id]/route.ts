import { z } from "zod";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { findLessonInClassroom } from "@/lib/authz";
import { assertCanManageFinance } from "@/service/finance/access";
import { getLessonPeriodsFinance } from "@/service/finance/period";
import { getLessonRules, setLessonRule } from "@/service/finance/rules";

type Params = { id: string };

async function requireLesson(raw: string, classroomId: number) {
  const id = parseId(raw, "lesson id");
  if (!(await findLessonInClassroom(id, classroomId))) throw notFound("Lesson");
  return id;
}

/** 一門課的分帳規則、單堂覆寫、每個時段的錢。 */
export const GET = apiRoute<Params>(async ({ params, classroomId }) => {
  const lessonId = await requireLesson(params.id, classroomId);
  const [rules, periods] = await Promise.all([getLessonRules(lessonId), getLessonPeriodsFinance(classroomId, lessonId)]);
  return { ...rules, periods };
});

export const PUT = apiRoute<Params>(async ({ request, params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const lessonId = await requireLesson(params.id, classroomId);
  const { rule } = await parseBody(request, z.object({ rule: z.unknown() }));
  return { rule: await setLessonRule(classroomId, lessonId, rule, userId) };
});
