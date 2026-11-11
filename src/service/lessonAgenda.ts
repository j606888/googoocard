import prisma from "@/lib/prisma";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { locationSummarySelect } from "@/lib/locations";
import { teacherSummarySelect } from "@/lib/teachers";

/** 往後帶幾天內開始的時段（本週課表）。 */
export const AGENDA_UPCOMING_DAYS = 7;
/** 已開始的時段最多帶幾堂（新的在前）；放著不點名的課再多也只是這份清單變長。 */
const STARTED_TAKE = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

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
      location: { select: locationSummarySelect },
      teachers: { select: { teacher: { select: teacherSummarySelect } }, orderBy: { id: "asc" } },
      assistants: { select: { teacher: { select: teacherSummarySelect } }, orderBy: { id: "asc" } },
      _count: { select: { students: true } },
    },
  },
} as const;

/**
 * 課程列表頂端用的時段（進行中的課）：
 * - 已開始、還沒點名的（→ 還沒點名、上課中還沒點）
 * - 正在上的，不管點過沒（→ 上課中，補勾遲到）
 * - 往後 7 天內開始的每一堂（→ 下一堂、本週課表）
 *
 * 只撈「可能相關」的集合；排成還沒點名／上課中／接下來由前端的 `agendaRows()`
 * （`src/features/lessons/useLessonAgenda.ts`）照當下時間決定。
 *
 * `myTeacherId` = 這位成員連著的老師資料（`Teacher.userId`，取代舊的「我接下來的課」）：
 * 主角優先挑「我的課」＝我教的＋我當小幫手的。全教室往後只撈 7 天，
 * 自己的下一堂可能更遠，所以另外撈。
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
      where: {
        lesson: lessonWhere,
        startTime: { gt: now, lte: new Date(now.getTime() + AGENDA_UPCOMING_DAYS * DAY_MS) },
      },
      orderBy: { startTime: "asc" },
      select: periodSelect,
    }),
    myTeacher
      ? prisma.lessonPeriod.findMany({
          where: {
            lesson: {
              ...lessonWhere,
              OR: [
                { teachers: { some: { teacherId: myTeacher.id } } },
                { assistants: { some: { teacherId: myTeacher.id } } },
              ],
            },
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
          location: lesson.location,
          teachers: lesson.teachers.map(({ teacher }) => teacher),
          assistants: lesson.assistants.map(({ teacher }) => teacher),
          studentCount: lesson._count.students,
          totalPeriods: order.length,
        },
      };
    }),
  };
}
