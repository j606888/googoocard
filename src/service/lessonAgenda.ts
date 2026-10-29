import prisma from "@/lib/prisma";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { teacherSummarySelect } from "@/lib/teachers";

/** 往後最多帶幾堂——只夠挑「下一堂」，不是行事曆。 */
const UPCOMING_TAKE = 10;
/** 已開始的時段最多帶幾堂（新的在前）；放著不點名的課再多也只是這份清單變長。 */
const STARTED_TAKE = 60;

const periodSelect = {
  id: true,
  lessonId: true,
  startTime: true,
  endTime: true,
  attendanceTakenAt: true,
  attendanceRecords: { select: { studentId: true } },
  lesson: {
    select: {
      id: true,
      name: true,
      kind: true,
      danceStyle: { select: danceStyleSummarySelect },
      teachers: { select: { teacher: { select: teacherSummarySelect } }, orderBy: { id: "asc" } },
      _count: { select: { students: true } },
    },
  },
} as const;

/**
 * 課程列表頂端用的時段（進行中的課）：
 * - 已開始、還沒點名的（→ 還沒點名、上課中還沒點）
 * - 正在上的，不管點過沒（→ 上課中，補勾遲到）
 * - 接下來的幾堂（→ 下一堂）
 *
 * 只撈「可能相關」的集合；挑哪一堂當主角由前端的 `pickHero()`
 * （`src/features/lessons/lessonSchedule.ts`）照當下時間決定。
 *
 * `myTeacherId` = 這位成員連著的老師（`Teacher.userId`，取代舊的「我接下來的課」）：
 * 主角優先挑自己教的課。全教室往後只撈 10 堂，自己的下一堂可能不在裡面，所以另外撈。
 */
export async function getLessonAgenda(classroomId: number, now = new Date(), userId?: number) {
  const lessonWhere = { classroomId, status: "inProgress" };
  const myTeacher = userId
    ? await prisma.teacher.findFirst({ where: { classroomId, userId }, select: { id: true } })
    : null;
  const [started, upcoming, myUpcoming] = await Promise.all([
    prisma.lessonPeriod.findMany({
      where: {
        lesson: lessonWhere,
        startTime: { lte: now },
        OR: [{ attendanceTakenAt: null }, { endTime: { gt: now } }],
      },
      orderBy: { startTime: "desc" },
      take: STARTED_TAKE,
      select: periodSelect,
    }),
    prisma.lessonPeriod.findMany({
      where: { lesson: lessonWhere, startTime: { gt: now } },
      orderBy: { startTime: "asc" },
      take: UPCOMING_TAKE,
      select: periodSelect,
    }),
    myTeacher
      ? prisma.lessonPeriod.findMany({
          where: {
            lesson: { ...lessonWhere, teachers: { some: { teacherId: myTeacher.id } } },
            startTime: { gt: now },
          },
          orderBy: { startTime: "asc" },
          take: 1,
          select: periodSelect,
        })
      : [],
  ]);

  const seen = new Set<number>();
  const periods = [...started, ...upcoming, ...myUpcoming].filter((p) =>
    seen.has(p.id) ? false : (seen.add(p.id), true)
  );
  const lessonIds = [...new Set(periods.map((p) => p.lessonId))];

  // 「第 N 堂」要知道整門課的時段順序：一次撈這幾門課的所有時段 id。
  const allPeriods = await prisma.lessonPeriod.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true, lessonId: true },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
  const orderByLesson = new Map<number, number[]>();
  for (const p of allPeriods) {
    const list = orderByLesson.get(p.lessonId);
    if (list) list.push(p.id);
    else orderByLesson.set(p.lessonId, [p.id]);
  }

  return {
    myTeacherId: myTeacher?.id ?? null,
    periods: periods.map(({ lesson, attendanceRecords, lessonId, ...period }) => {
      const order = orderByLesson.get(lessonId) ?? [];
      return {
        ...period,
        number: order.indexOf(period.id) + 1,
        attendeeIds: attendanceRecords.map((r) => r.studentId),
        lesson: {
          id: lesson.id,
          name: lesson.name,
          kind: lesson.kind,
          danceStyle: lesson.danceStyle,
          teachers: lesson.teachers.map(({ teacher }) => teacher),
          studentCount: lesson._count.students,
          totalPeriods: order.length,
        },
      };
    }),
  };
}
