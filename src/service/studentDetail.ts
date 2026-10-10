import { toDanceLevels } from "@/domains/qualification";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { danceStyleSummarySelect } from "@/lib/danceStyles";

/**
 * The Student columns an API response may carry.
 *
 * This is a whitelist on purpose — NEVER `...spread` a Student row into a
 * response. The row holds three secrets that grant access on their own:
 *
 *   - `lineBindKey`  — send it to the LINE bot and it binds that Student to
 *                      YOUR LINE account (see api/line/webhook). Full takeover:
 *                      self check-in, card balances, buying cards as them.
 *   - `randomKey`    — the public share-link token for /public-students.
 *   - `lineUserId`   — the student's LINE account id.
 *
 * `lineBindKey` must only ever leave via `api/students/[id]/line-bind-link`,
 * which is authenticated and classroom-scoped.
 */
type StudentRow = {
  id: number;
  number: number;
  name: string;
  avatarUrl: string;
  note: string | null;
  randomKey: string | null;
  classroomId: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toStudentPayload(
  student: StudentRow,
  { includeShareKey = false }: { includeShareKey?: boolean } = {}
) {
  return {
    id: student.id,
    number: student.number,
    name: student.name,
    avatarUrl: student.avatarUrl,
    note: student.note,
    classroomId: student.classroomId,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    // Only the teacher-facing student detail needs the share-link token; the
    // public page and LIFF must not hand out a token they already used.
    ...(includeShareKey ? { randomKey: student.randomKey } : {}),
  };
}

/**
 * The other end of a card-conversion chain, for showing「來自 #A0412」/
 * 「已轉換為 #A0873」on a StudentCard. Whitelisted fields only; both ends
 * always belong to the same student.
 */
export const conversionLinksInclude = {
  convertedTo: {
    select: { id: true, serialNumber: true, totalSessions: true, card: { select: { name: true } } },
  },
  convertedFrom: {
    select: { id: true, serialNumber: true, remainingSessions: true, card: { select: { name: true } } },
    orderBy: { id: "asc" },
  },
} as const;

/**
 * 「最近上課」= the latest class the student attended, dated by the class
 * (`lessonPeriod.startTime`) — not by when the teacher took attendance, which
 * can land after midnight, and not by the record's `createdAt`. Self check-ins
 * still awaiting the teacher count too: the student was there and the card was
 * already charged.
 *
 * Use as `attendanceRecords: lastAttendanceQuery` in a Student include, then
 * read it with `toLastAttendance`.
 */
export const lastAttendanceQuery = {
  orderBy: { lessonPeriod: { startTime: "desc" } },
  take: 1,
  select: {
    lessonPeriod: {
      select: { startTime: true, lesson: { select: { name: true } } },
    },
  },
} as const;

export function toLastAttendance(
  records: { lessonPeriod: { startTime: Date; lesson: { name: string } } }[]
) {
  const last = records[0];
  return {
    lastAttendAt: last?.lessonPeriod.startTime ?? null,
    lastAttendLessonName: last?.lessonPeriod.lesson.name ?? null,
  };
}

export async function findLastAttendance(studentId: number) {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId },
    ...lastAttendanceQuery,
  });
  return toLastAttendance(records);
}

/**
 * Assemble the full student-detail payload (overview, cards with their
 * attendance, attendance grouped by lesson and by date, dance qualifications)
 * for a single student. Shared by the public share page (`/public-students`)
 * and the student LIFF "我的課卡" entry (`/api/liff/me`).
 *
 * Both callers are unauthenticated (a share token / a LIFF ID token), so the
 * payload runs through `toStudentPayload` with no share key.
 *
 * Returns null if the student doesn't exist.
 */
export async function buildStudentDetailPayload(studentId: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      lessons: true,
      // NOT `classroom: true` — the full row carries `checkinKey`, the
      // walk-in QR self check-in secret for the whole classroom.
      classroom: { select: { id: true, name: true } },
      // Ordered and joined to their style so pages without a teacher session
      // (LIFF, the public share link) can label them without /api/dance-styles.
      danceQualifications: {
        include: { danceStyle: { select: danceStyleSummarySelect } },
        orderBy: { danceStyle: { sortOrder: "asc" } },
      },
      studentCards: {
        include: {
          card: { include: { danceStyle: { select: danceStyleSummarySelect } } },
          ...conversionLinksInclude,
        },
        orderBy: { createdAt: "desc" },
      },
      attendanceRecords: {
        include: { lessonPeriod: true, studentCard: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) return null;

  const lastAttendance = await findLastAttendance(student.id);

  const { attendanceRecords, studentCards, danceQualifications } = student;

  const overview = {
    ...lastAttendance,
    attendLessonCount: student.lessons.length,
    cardCount: studentCards.length,
    totalSpend: studentCards.reduce((acc, card) => acc + card.finalPrice, 0),
    totalSaved: studentCards.reduce((acc, card) => acc + (card.basePrice - card.finalPrice), 0),
  };

  const attendLessonIds = [...new Set(attendanceRecords.map((record) => record.lessonPeriod.lessonId))];
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: attendLessonIds } },
    include: {
      periods: { orderBy: { startTime: "asc" } },
    },
  });

  const attendancesByLesson = lessons.map((lesson) => {
    return {
      lessonId: lesson.id,
      lessonName: lesson.name,
      totalPeriods: lesson.periods.length,
      lessonPeriodIds: lesson.periods.map((period) => period.id),
      studentAttendances: lesson.periods.map((period) => {
        return {
          studentAttend: false,
          periodId: period.id,
          periodStartTime: period.startTime,
          periodAttendantCheck: !!period.attendanceTakenAt,
        };
      }),
      attendances: [] as {
        periodStartTime: Date;
        periodNumber: number;
        totalPeriods: number;
      }[],
    };
  });

  const attendancesByDate = {} as {
    [dateKey: string]: {
      date: number;
      attendances: {
        lessonName: string;
        periodNumber: number;
        totalPeriods: number;
      }[];
    };
  };

  // Create a map to group attendance records by student card
  const studentCardAttendances = new Map<number, Array<{ lessonName: string; periodStartTime: Date }>>();

  attendanceRecords.forEach((record) => {
    const lessonId = record.lessonPeriod.lessonId;
    const lessonPeriodId = record.lessonPeriod.id;
    const periodStartTime = record.lessonPeriod.startTime;

    const lesson = lessons.find((lesson) => lesson.id === lessonId);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found`);
    }

    const attendanceData = {
      periodStartTime,
      periodNumber: lesson.periods.findIndex((period) => period.id === lessonPeriodId) + 1,
      totalPeriods: lesson.periods.length,
    };
    attendancesByLesson.find((lesson) => lesson.lessonId === lessonId)?.attendances.push(attendanceData);
    const studentAttendance = attendancesByLesson
      .find((lesson) => lesson.lessonId === lessonId)
      ?.studentAttendances.find((attendance) => attendance.periodId === lessonPeriodId);
    if (studentAttendance) {
      studentAttendance.studentAttend = true;
    }

    // Group attendance records by student card
    if (record.studentCardId) {
      const cardAttendances = studentCardAttendances.get(record.studentCardId) || [];
      cardAttendances.push({
        lessonName: lesson.name,
        periodStartTime,
      });
      studentCardAttendances.set(record.studentCardId, cardAttendances);
    }
  });

  // Create enhanced student cards with attendance records
  const studentCardsWithAttendances = studentCards.map((card) => ({
    ...card,
    attendanceRecords: studentCardAttendances.get(card.id) || [],
  }));

  attendancesByLesson.forEach((lesson) => {
    lesson.attendances.forEach((attendance) => {
      const dateKey = formatDate(attendance.periodStartTime.getTime());
      if (!attendancesByDate[dateKey]) {
        attendancesByDate[dateKey] = {
          date: attendance.periodStartTime.getTime(),
          attendances: [
            {
              lessonName: lesson.lessonName,
              periodNumber: attendance.periodNumber,
              totalPeriods: lesson.totalPeriods,
            },
          ],
        };
      } else {
        attendancesByDate[dateKey].attendances.push({
          lessonName: lesson.lessonName,
          periodNumber: attendance.periodNumber,
          totalPeriods: lesson.totalPeriods,
        });
      }
    });
  });

  const sortedAttendancesByDate = Object.values(attendancesByDate).sort((a, b) => b.date - a.date);

  return {
    overview,
    attendancesByDate: sortedAttendancesByDate,
    attendancesByLesson,
    studentCards: studentCardsWithAttendances,
    danceQualifications: danceQualifications.flatMap((q) => (q.danceStyleId === null ? [] : [q.danceStyleId])),
    danceLevels: toDanceLevels(danceQualifications),
    qualifiedDanceStyles: danceQualifications.flatMap((q) => (q.danceStyle ? [q.danceStyle] : [])),
    classroom: student.classroom,
    ...toStudentPayload(student),
  };
}
