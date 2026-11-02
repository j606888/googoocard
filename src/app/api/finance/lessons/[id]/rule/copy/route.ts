import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { splitRuleSchema } from "@/domains/finance/types";
import { assertFinance } from "@/service/finance/access";
import { requireLesson, saveLessonRule, validateRule } from "@/service/finance/rules";

const bodySchema = z.object({ fromLessonId: z.number().int().positive() });

export const POST = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const lesson = await requireLesson(parseId(params.id), classroomId);
  const { fromLessonId } = await parseBody(request, bodySchema);
  const from = await requireLesson(fromLessonId, classroomId);
  const row = await prisma.lessonSplitRule.findUnique({
    where: { lessonId: from.id },
    select: { rule: true },
  });
  if (!row) throw new ApiError(404, "NO_RULE", "Source lesson has no split rule");
  const rule = splitRuleSchema.parse(row.rule);
  await validateRule(classroomId, rule);
  await saveLessonRule(lesson.id, rule, userId);
  return { rule };
});
