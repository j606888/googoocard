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

/**
 * 存規則前檢查並整理（2026-11-10 定案：錢一律記在課程標的分部）：
 * 規則裡的公積金只能是這門課的分部（否則 400 FUND_OTHER_BRANCH），「不夠扣時誰吸收」也固定是這個分部。
 * 課沒標分部時不檢查。回傳要存的規則。
 */
export async function validateRule(classroomId: number, rule: SplitRule, lessonLocationId: number | null = null): Promise<SplitRule> {
  assertSingleVenuePack(rule);
  await validateRuleRefs(classroomId, rule);
  if (lessonLocationId === null) return rule;
  const funds = [
    ...rule.lines.flatMap((l) => (l.kind !== "venuePack" && l.to.type === "fund" ? [l.to.locationId] : [])),
    ...(rule.rest.type === "fund" ? [rule.rest.locationId] : []),
  ];
  if (funds.some((id) => id !== lessonLocationId)) {
    throw new ApiError(400, "FUND_OTHER_BRANCH", "A rule may only use the fund of the lesson's own branch");
  }
  return { ...rule, fundLocationId: lessonLocationId };
}

export async function requireLesson(lessonId: number, classroomId: number) {
  const l = await prisma.lesson.findFirst({ where: { id: lessonId, classroomId }, select: { id: true, locationId: true } });
  if (!l) throw new ApiError(404, "NOT_FOUND", "Lesson not found");
  return l;
}

export async function requirePeriod(periodId: number, classroomId: number) {
  const p = await prisma.lessonPeriod.findFirst({
    where: { id: periodId, lesson: { classroomId } },
    select: { id: true, lesson: { select: { locationId: true } } },
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
