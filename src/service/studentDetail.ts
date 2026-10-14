import { toDanceLevels } from "@/domains/qualification";
import prisma from "@/lib/prisma";
import type { AttendanceSource, Prisma } from "@prisma/client";
import { danceStyleSummarySelect, type DanceStyleSummary } from "@/lib/danceStyles";
import { parseTaipeiMonthRange, toTaipeiDateKey, toTaipeiMonthKey } from "@/lib/taipei-date";

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
  archivedAt?: Date | null;
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
    archivedAt: student.archivedAt ?? null,
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

/**
 * Attendance history include for the student-detail payloads: each record
 * with its period, the lesson's name and dance style, and the card it charged.
 */
export const attendanceHistoryInclude = {
  include: {
    lessonPeriod: {
      include: {
        lesson: { select: { id: true, name: true, danceStyle: { select: danceStyleSummarySelect } } },
      },
    },
    studentCard: { select: { id: true, serialNumber: true, card: { select: { name: true } } } },
  },
  orderBy: { lessonPeriod: { startTime: "desc" } },
} as const;

type AttendanceHistoryRecord = Prisma.AttendanceRecordGetPayload<typeof attendanceHistoryInclude>;

/**
 * 出席統計：全部以上課日（`lessonPeriod.startTime`）、台北時區分月。
 * `attendedCount` 是出席過的時段數 —— 不是報名過幾門課（舊的 attendLessonCount）。
 */
export function attendanceCounts(records: { lessonPeriod: { startTime: Date } }[], now = new Date()) {
  const thisMonth = toTaipeiMonthKey(now);
  const { start: thisMonthStart } = parseTaipeiMonthRange(thisMonth);
  const lastMonth = toTaipeiMonthKey(new Date(thisMonthStart.getTime() - 1));
  let thisMonthCount = 0;
  let lastMonthCount = 0;
  for (const record of records) {
    const month = toTaipeiMonthKey(record.lessonPeriod.startTime);
    if (month === thisMonth) thisMonthCount++;
    else if (month === lastMonth) lastMonthCount++;
  }
  return { attendedCount: records.length, thisMonthCount, lastMonthCount };
}

/**
 * The attendance views shared by the teacher detail and the public / LIFF
 * payload: by lesson (every period, attended or not), by Taipei date (each
 * attendance with its style, card and source), and each card's usage.
 */
export async function buildAttendanceViews(attendanceRecords: AttendanceHistoryRecord[]) {
  const attendLessonIds = [...new Set(attendanceRecords.map((record) => record.lessonPeriod.lessonId))];
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: attendLessonIds } },
    include: {
      periods: { orderBy: { startTime: "asc" } },
      danceStyle: { select: danceStyleSummarySelect },
    },
  });
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  // 依課程：該課的每個時段都列出來（出席與否），第 N 堂 = 時段依時間排序的序號。
  const attendancesByLesson = lessons.map((lesson) => ({
    lessonId: lesson.id,
    lessonName: lesson.name,
    danceStyle: lesson.danceStyle,
    level: lesson.level,
    status: lesson.status,
    totalPeriods: lesson.periods.length,
    lessonPeriodIds: lesson.periods.map((period) => period.id),
    studentAttendances: lesson.periods.map((period, index) => ({
      periodId: period.id,
      periodNumber: index + 1,
      periodStartTime: period.startTime,
      periodAttendantCheck: !!period.attendanceTakenAt,
      studentAttend: false,
      studentCard: null as { id: number; serialNumber: number; name: string } | null,
      pending: false,
    })),
  }));
  const slotByPeriodId = new Map(
    attendancesByLesson.flatMap((entry) => entry.studentAttendances.map((slot) => [slot.periodId, slot] as const))
  );

  const byDate = new Map<
    string,
    {
      date: number;
      attendances: {
        lessonId: number;
        lessonName: string;
        periodNumber: number;
        totalPeriods: number;
        startTime: Date;
        danceStyle: DanceStyleSummary | null;
        studentCard: { id: number; serialNumber: number; name: string } | null;
        source: AttendanceSource;
        // 學生自助簽到、老師還沒定案這個時段
        pending: boolean;
      }[];
    }
  >();
  const studentCardAttendances = new Map<
    number,
    { lessonName: string; periodStartTime: Date; source: AttendanceSource; pending: boolean }[]
  >();

  // Records arrive newest class first, so every list below is newest first too.
  for (const record of attendanceRecords) {
    const { lessonPeriod } = record;
    const lesson = lessonById.get(lessonPeriod.lessonId);
    if (!lesson) throw new Error(`Lesson ${lessonPeriod.lessonId} not found`);

    const studentCard = record.studentCard
      ? { id: record.studentCard.id, serialNumber: record.studentCard.serialNumber, name: record.studentCard.card.name }
      : null;
    const pending = record.source === "STUDENT" && !lessonPeriod.attendanceTakenAt;

    const slot = slotByPeriodId.get(lessonPeriod.id);
    if (slot) {
      slot.studentAttend = true;
      slot.studentCard = studentCard;
      slot.pending = pending;
    }

    const dateKey = toTaipeiDateKey(lessonPeriod.startTime);
    const day = byDate.get(dateKey) ?? { date: lessonPeriod.startTime.getTime(), attendances: [] };
    day.attendances.push({
      lessonId: lesson.id,
      lessonName: lessonPeriod.lesson.name,
      periodNumber: slot?.periodNumber ?? 0,
      totalPeriods: lesson.periods.length,
      startTime: lessonPeriod.startTime,
      danceStyle: lessonPeriod.lesson.danceStyle,
      studentCard,
      source: record.source,
      pending,
    });
    byDate.set(dateKey, day);

    if (record.studentCardId) {
      const usage = studentCardAttendances.get(record.studentCardId) ?? [];
      usage.push({
        lessonName: lesson.name,
        periodStartTime: lessonPeriod.startTime,
        source: record.source,
        pending,
      });
      studentCardAttendances.set(record.studentCardId, usage);
    }
  }

  return {
    attendancesByLesson,
    attendancesByDate: [...byDate.values()],
    studentCardAttendances,
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
      attendanceRecords: attendanceHistoryInclude,
    },
  });

  if (!student) return null;

  const { attendanceRecords, studentCards, danceQualifications } = student;

  const overview = {
    ...toLastAttendance(attendanceRecords),
    ...attendanceCounts(attendanceRecords),
    cardCount: studentCards.length,
    totalSpend: studentCards.reduce((acc, card) => acc + card.finalPrice, 0),
    totalSaved: studentCards.reduce((acc, card) => acc + (card.basePrice - card.finalPrice), 0),
  };

  const { attendancesByLesson, attendancesByDate, studentCardAttendances } =
    await buildAttendanceViews(attendanceRecords);

  const studentCardsWithAttendances = studentCards.map((card) => ({
    ...card,
    attendanceRecords: studentCardAttendances.get(card.id) ?? [],
  }));

  return {
    overview,
    attendancesByDate,
    attendancesByLesson,
    studentCards: studentCardsWithAttendances,
    danceQualifications: danceQualifications.flatMap((q) => (q.danceStyleId === null ? [] : [q.danceStyleId])),
    danceLevels: toDanceLevels(danceQualifications),
    qualifiedDanceStyles: danceQualifications.flatMap((q) => (q.danceStyle ? [q.danceStyle] : [])),
    classroom: student.classroom,
    ...toStudentPayload(student),
  };
}
