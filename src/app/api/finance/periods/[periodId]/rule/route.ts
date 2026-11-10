import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { splitRuleSchema } from "@/domains/finance/types";
import { assertCanSettle, assertFinanceEnabled } from "@/service/finance/access";
import { requirePeriod, validateRule } from "@/service/finance/rules";

export const GET = apiRoute<{ periodId: string }>(async ({ params, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const period = await requirePeriod(parseId(params.periodId), classroomId);
  const row = await prisma.periodSplitOverride.findUnique({
    where: { lessonPeriodId: period.id },
    select: { rule: true },
  });
  return { rule: row?.rule ?? null };
});

export const PUT = apiRoute<{ periodId: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const period = await requirePeriod(parseId(params.periodId), classroomId);
  const rule = await validateRule(classroomId, await parseBody(request, splitRuleSchema), period.lesson.locationId);
  await prisma.periodSplitOverride.upsert({
    where: { lessonPeriodId: period.id },
    create: { lessonPeriodId: period.id, rule, updatedById: userId },
    update: { rule, updatedById: userId },
  });
  return { rule };
});

export const DELETE = apiRoute<{ periodId: string }>(async ({ params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const period = await requirePeriod(parseId(params.periodId), classroomId);
  await prisma.periodSplitOverride.deleteMany({ where: { lessonPeriodId: period.id } });
  return { ok: true };
});
