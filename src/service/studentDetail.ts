import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

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
      danceQualifications: true,
      studentCards: {
        include: { card: true },
        orderBy: { createdAt: "desc" },
      },
      attendanceRecords: {
        include: { lessonPeriod: true, studentCard: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) return null;

  const lastAttendance = await prisma.attendanceRecord.findFirst({
    where: { studentId: student.id },
    include: { lessonPeriod: true },
    orderBy: { createdAt: "desc" },
  });

  const { attendanceRecords, studentCards, danceQualifications } = student;

  const overview = {
    lastAttendAt: lastAttendance?.lessonPeriod.attendanceTakenAt,
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
    danceQualifications: danceQualifications.map((q) => q.danceType),
    classroom: student.classroom,
    ...toStudentPayload(student),
  };
}
