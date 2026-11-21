import prisma from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/apiError";
import { splitRuleSchema, type SplitRule } from "@/domains/finance/types";

/** 規則裡提到的老師、場地、分部都要是這個教室的。 */
async function assertRuleRefs(classroomId: number, rule: SplitRule) {
  const teacherIds = new Set<number>();
  const venueIds = new Set<number>();
  const locationIds = new Set<number>();
  for (const line of rule.lines) {
    if (line.kind === "venuePack") venueIds.add(line.venueId);
    else if (line.to.type === "teacher") teacherIds.add(line.to.teacherId);
    else if (line.to.type === "venue") venueIds.add(line.to.venueId);
    else if (line.to.type === "fund") locationIds.add(line.to.locationId);
  }
  if (rule.rest.type === "teachers") rule.rest.shares.forEach((s) => teacherIds.add(s.teacherId));
  if (rule.rest.type === "fund") locationIds.add(rule.rest.locationId);

  const [t, v, l] = await Promise.all([
    prisma.teacher.count({ where: { classroomId, id: { in: [...teacherIds] } } }),
    prisma.venue.count({ where: { classroomId, id: { in: [...venueIds] } } }),
    prisma.location.count({ where: { classroomId, id: { in: [...locationIds] } } }),
  ]);
  if (t !== teacherIds.size || v !== venueIds.size || l !== locationIds.size) {
    throw badRequest("RULE_BAD_REFERENCE", "Rule mentions a teacher, venue or branch outside this classroom");
  }
}

export function parseRule(raw: unknown): SplitRule {
  const parsed = splitRuleSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("RULE_INVALID", "Invalid split rule");
  return parsed.data;
}

export async function getLessonRules(lessonId: number) {
  const [lessonRule, overrides] = await Promise.all([
    prisma.lessonSplitRule.findUnique({ where: { lessonId } }),
    prisma.periodSplitOverride.findMany({ where: { lessonPeriod: { lessonId } } }),
  ]);
  return {
    rule: lessonRule ? parseRule(lessonRule.rule) : null,
    overrides: overrides.map((o) => ({ periodId: o.lessonPeriodId, rule: parseRule(o.rule) })),
  };
}

export async function setLessonRule(classroomId: number, lessonId: number, raw: unknown, userId: number) {
  const rule = parseRule(raw);
  await assertRuleRefs(classroomId, rule);
  await prisma.lessonSplitRule.upsert({
    where: { lessonId },
    create: { lessonId, rule, updatedById: userId },
    update: { rule, updatedById: userId },
  });
  return rule;
}

export async function setPeriodOverride(
  classroomId: number,
  lessonId: number,
  periodId: number,
  raw: unknown | null,
  userId: number
) {
  const period = await prisma.lessonPeriod.findFirst({ where: { id: periodId, lessonId }, select: { id: true } });
  if (!period) throw notFound("Period");
  if (raw === null) {
    await prisma.periodSplitOverride.deleteMany({ where: { lessonPeriodId: periodId } });
    return null;
  }
  const rule = parseRule(raw);
  await assertRuleRefs(classroomId, rule);
  await prisma.periodSplitOverride.upsert({
    where: { lessonPeriodId: periodId },
    create: { lessonPeriodId: periodId, rule, updatedById: userId },
    update: { rule, updatedById: userId },
  });
  return rule;
}

