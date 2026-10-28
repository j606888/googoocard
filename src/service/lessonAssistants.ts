import prisma from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/apiError";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { teacherSummarySelect } from "@/lib/teachers";

/**
 * 每堂的助教（點名頁「今天的助教」）。核心資料：不開水庫也記誰來幫忙；
 * 水庫照分帳規則算助教費（docs/finance-db.md §3）。
 */

const assistantSelect = { ...teacherSummarySelect, isAssistant: true } as const;

export type PeriodAssistants = {
  assistants: { id: number; name: string; color: string; isAssistant: boolean }[];
  /** true ＝ 這堂還沒記過助教，這是同一天上一堂帶過來的建議，還沒存。 */
  suggested: boolean;
};

async function findPeriod(lessonId: number, periodId: number, classroomId: number) {
  const period = await prisma.lessonPeriod.findFirst({
    where: { id: periodId, lessonId, lesson: { classroomId } },
    select: {
      id: true,
      startTime: true,
      attendanceTakenAt: true,
      lesson: { select: { locationId: true, teachers: { select: { teacherId: true } } } },
    },
  });
  if (!period) throw notFound("Lesson period");
  return period;
}

async function savedAssistants(lessonPeriodId: number) {
  const rows = await prisma.lessonPeriodAssistant.findMany({
    where: { lessonPeriodId },
    select: { teacher: { select: assistantSelect } },
    orderBy: { id: "asc" },
  });
  return rows.map((row) => row.teacher);
}

/**
 * 存過的助教；這堂還沒點名、也還沒記過助教時，改帶同一天、同一分部、
 * 比這堂早且有記助教的最近一堂（台南週日一位助教幫整天）。封存的老師不帶。
 */
export async function getPeriodAssistants(input: {
  classroomId: number;
  lessonId: number;
  periodId: number;
}): Promise<PeriodAssistants> {
  const period = await findPeriod(input.lessonId, input.periodId, input.classroomId);
  const saved = await savedAssistants(period.id);
  if (saved.length > 0 || period.attendanceTakenAt) return { assistants: saved, suggested: false };

  const { start } = parseTaipeiDateRange(toTaipeiDateKey(period.startTime));
  const previous = await prisma.lessonPeriod.findFirst({
    where: {
      id: { not: period.id },
      startTime: { gte: start, lt: period.startTime },
      lesson: { classroomId: input.classroomId, locationId: period.lesson.locationId },
      assistants: { some: { teacher: { archivedAt: null } } },
    },
    orderBy: { startTime: "desc" },
    select: {
      assistants: {
        where: { teacher: { archivedAt: null } },
        select: { teacher: { select: assistantSelect } },
        orderBy: { id: "asc" },
      },
    },
  });
  const lessonTeacherIds = new Set(period.lesson.teachers.map((t) => t.teacherId));
  const suggestion = (previous?.assistants ?? [])
    .map((row) => row.teacher)
    .filter((teacher) => !lessonTeacherIds.has(teacher.id));
  return { assistants: suggestion, suggested: suggestion.length > 0 };
}

/**
 * 整組覆寫（跟點名的 studentIds 一樣以送來的為準）。這堂的授課老師不能同時當助教；
 * 新加的不能是封存的老師（已經掛著的封存老師可以留著）。
 */
export async function setPeriodAssistants(input: {
  classroomId: number;
  lessonId: number;
  periodId: number;
  teacherIds: number[];
}): Promise<PeriodAssistants> {
  const period = await findPeriod(input.lessonId, input.periodId, input.classroomId);
  const ids = [...new Set(input.teacherIds)];

  const lessonTeacherIds = new Set(period.lesson.teachers.map((t) => t.teacherId));
  if (ids.some((id) => lessonTeacherIds.has(id))) {
    throw badRequest("ASSISTANT_IS_TEACHER", "A lesson's own teacher can't be its assistant");
  }

  const [teachers, current] = await Promise.all([
    prisma.teacher.findMany({
      where: { id: { in: ids }, classroomId: input.classroomId },
      select: { id: true, archivedAt: true },
    }),
    prisma.lessonPeriodAssistant.findMany({
      where: { lessonPeriodId: period.id },
      select: { teacherId: true },
    }),
  ]);
  if (teachers.length !== ids.length) throw badRequest("TEACHER_NOT_FOUND", "Unknown teacher");
  const currentIds = new Set(current.map((row) => row.teacherId));
  if (teachers.some((t) => t.archivedAt && !currentIds.has(t.id))) {
    throw badRequest("TEACHER_ARCHIVED", "Archived teachers can't be added");
  }

  await prisma.$transaction([
    prisma.lessonPeriodAssistant.deleteMany({
      where: { lessonPeriodId: period.id, teacherId: { notIn: ids } },
    }),
    prisma.lessonPeriodAssistant.createMany({
      data: ids.map((teacherId) => ({ lessonPeriodId: period.id, teacherId })),
      skipDuplicates: true,
    }),
  ]);

  return { assistants: await savedAssistants(period.id), suggested: false };
}
