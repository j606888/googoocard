import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { splitRuleSchema } from "@/domains/finance/types";
import { assertCanSettle, assertFinanceEnabled } from "@/service/finance/access";
import { requireLesson, saveLessonRule, validateRule } from "@/service/finance/rules";

export const GET = apiRoute<{ id: string }>(async ({ params, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const lesson = await requireLesson(parseId(params.id), classroomId);
  const row = await prisma.lessonSplitRule.findUnique({
    where: { lessonId: lesson.id },
    select: { rule: true },
  });
  return { rule: row?.rule ?? null };
});

export const PUT = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const lesson = await requireLesson(parseId(params.id), classroomId);
  const rule = await validateRule(classroomId, await parseBody(request, splitRuleSchema), lesson.locationId);
  await saveLessonRule(lesson.id, rule, userId);
  return { rule };
});

export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const lesson = await requireLesson(parseId(params.id), classroomId);
  await prisma.lessonSplitRule.deleteMany({ where: { lessonId: lesson.id } });
  return { ok: true };
});
