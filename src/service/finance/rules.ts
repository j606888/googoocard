import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import type { Payee, SplitRule } from "@/domains/finance/types";

export function refsOf(rule: SplitRule) {
  const teacherIds = new Set<number>();
  const locationIds = new Set<number>([rule.fundLocationId]);
  const venueIds = new Set<number>();
  const payee = (p: Payee) => {
    if (p.type === "teacher") teacherIds.add(p.teacherId);
    else if (p.type === "fund") locationIds.add(p.locationId);
    else venueIds.add(p.venueId);
  };
  for (const line of rule.lines) {
    if (line.kind === "venuePack") venueIds.add(line.venueId);
    else payee(line.to);
  }
  if (rule.rest.type === "fund") locationIds.add(rule.rest.locationId);
  else for (const s of rule.rest.shares) teacherIds.add(s.teacherId);
  return { teacherIds: [...teacherIds], locationIds: [...locationIds], venueIds: [...venueIds] };
}

/** 一條規則最多一個 venuePack 行，否則 400 INVALID_RULE。 */
export function assertSingleVenuePack(rule: SplitRule) {
  if (rule.lines.filter((l) => l.kind === "venuePack").length > 1) {
    throw new ApiError(400, "INVALID_RULE", "A rule may contain at most one venuePack line");
  }
}

/** 每個 teacherId／locationId／venueId 都在本教室，否則 400 INVALID_RULE_REF。 */
export async function validateRuleRefs(classroomId: number, rule: SplitRule): Promise<void> {
  const { teacherIds, locationIds, venueIds } = refsOf(rule);
  const [t, l, v] = await Promise.all([
    prisma.teacher.count({ where: { id: { in: teacherIds }, classroomId } }),
    prisma.location.count({ where: { id: { in: locationIds }, classroomId } }),
    prisma.venue.count({ where: { id: { in: venueIds }, classroomId } }),
  ]);
  if (t !== teacherIds.length || l !== locationIds.length || v !== venueIds.length) {
    throw new ApiError(400, "INVALID_RULE_REF", "Rule refers to a teacher, location or venue outside this classroom");
  }
}

export async function validateRule(classroomId: number, rule: SplitRule) {
  assertSingleVenuePack(rule);
  await validateRuleRefs(classroomId, rule);
}

export async function requireLesson(lessonId: number, classroomId: number) {
  const l = await prisma.lesson.findFirst({ where: { id: lessonId, classroomId }, select: { id: true } });
  if (!l) throw new ApiError(404, "NOT_FOUND", "Lesson not found");
  return l;
}

export async function requirePeriod(periodId: number, classroomId: number) {
  const p = await prisma.lessonPeriod.findFirst({
    where: { id: periodId, lesson: { classroomId } },
    select: { id: true },
  });
  if (!p) throw new ApiError(404, "NOT_FOUND", "Period not found");
  return p;
}

export async function saveLessonRule(lessonId: number, rule: SplitRule, userId: number) {
  await prisma.lessonSplitRule.upsert({
    where: { lessonId },
    create: { lessonId, rule, updatedById: userId },
    update: { rule, updatedById: userId },
  });
}
