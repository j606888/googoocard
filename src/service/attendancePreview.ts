import prisma from "@/lib/prisma";
import { cardOptionsFor } from "@/domains/attendance/attendance.service";
import { fetchStudentsWithValidCards } from "@/service/lessonCards";
import { enrollmentsCoveringPeriod } from "@/service/termEnrollment";

/** 一次最多預覽幾位名冊外的學生（老師臨時加勾的）。 */
const MAX_EXTRA_STUDENTS = 200;

export type CardPreview =
  /** 這個時段已經有紀錄、而且付掉了（多半是自助簽到當下扣的）。完成點名不會再扣。 */
  | { kind: "covered"; cardName: string | null; remaining: number | null }
  /** 完成點名時引擎會自己扣這張。 */
  | { kind: "auto"; cardName: string; remainingAfter: number }
  /** 有好幾張能用，引擎不替老師決定——點完名到完成頁選。 */
  | { kind: "choose"; count: number }
  /** 報了整期、這堂在他報的堂數內：不扣卡。`index` = 第幾堂（1 起算）。 */
  | { kind: "enrolled"; index: number; sessions: number }
  /** 沒有能用的卡（或這個時段已有一筆沒綁卡的紀錄，引擎不會動它）。 */
  | { kind: "none" };

/**
 * 點名頁每一列的「會扣哪張卡、扣完剩幾堂」。
 *
 * 唯讀，而且**不自己判斷**：候選卡用引擎同一支 `fetchStudentsWithValidCards`，
 * 選卡用引擎同一支 `cardOptionsFor`（體驗卡優先 → 複習卡優先 → 恰好一張才自動選）。
 * 這個時段已經有紀錄的學生，`reconcileAndFinalize` 不會再碰，所以照紀錄現況回報。
 * 前端不要另外算一份——算錯的剩餘堂數比不顯示更糟。
 */
export async function previewPeriodCards({
  lessonId,
  periodId,
  classroomId,
  extraStudentIds = [],
}: {
  lessonId: number;
  periodId: number;
  classroomId: number;
  /** 名冊外、老師這次勾的人。名冊與已有紀錄的人一律會算。 */
  extraStudentIds?: number[];
}): Promise<Record<number, CardPreview> | null> {
  const [lesson, period] = await Promise.all([
    prisma.lesson.findFirst({
      where: { id: lessonId, classroomId },
      include: { danceStyle: true, cards: { include: { card: true } }, students: { select: { studentId: true } } },
    }),
    prisma.lessonPeriod.findFirst({
      where: { id: periodId, lessonId },
      select: {
        bookings: { select: { studentId: true } },
        attendanceRecords: {
          select: {
            studentId: true,
            enrollmentId: true,
            dropInCharge: { select: { id: true } },
            studentCard: { select: { remainingSessions: true, card: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);
  if (!lesson || !period) return null;
  const covering = await enrollmentsCoveringPeriod(prisma, lessonId, periodId);
  const enrolledPreview = (studentId: number): CardPreview | null => {
    const e = covering.get(studentId);
    return e ? { kind: "enrolled", index: e.periodIndex + 1, sessions: e.sessions } : null;
  };

  const recordByStudent = new Map(period.attendanceRecords.map((record) => [record.studentId, record]));
  const ids = [
    ...new Set([
      ...lesson.students.map((s) => s.studentId),
      ...recordByStudent.keys(),
      ...covering.keys(),
      // 預計會來的人：還沒勾就先算好會扣哪張卡，點名頁那一區才看得到卡況。
      ...period.bookings.map((b) => b.studentId),
      ...extraStudentIds.slice(0, MAX_EXTRA_STUDENTS),
    ]),
  ];
  const students = await fetchStudentsWithValidCards(
    ids.filter((id) => !recordByStudent.has(id)),
    lesson.cards.map((card) => card.cardId),
    classroomId,
    lesson.sessionsPerAttendance
  );

  const previews: Record<number, CardPreview> = {};
  for (const [studentId, record] of recordByStudent) {
    previews[studentId] = record.enrollmentId !== null
      ? enrolledPreview(studentId) ?? { kind: "covered", cardName: null, remaining: null }
      : record.studentCard
      ? {
          kind: "covered",
          cardName: record.studentCard.card.name,
          remaining: record.studentCard.remainingSessions,
        }
      : record.dropInCharge
        ? { kind: "covered", cardName: null, remaining: null }
        : { kind: "none" };
  }
  for (const student of students) {
    const enrolled = enrolledPreview(student.id);
    if (enrolled) {
      previews[student.id] = enrolled;
      continue;
    }
    const { usable, autoPick } = cardOptionsFor(student, lesson);
    previews[student.id] = autoPick
      ? {
          kind: "auto",
          cardName: autoPick.card.name,
          remainingAfter: autoPick.remainingSessions - lesson.sessionsPerAttendance,
        }
      : usable.length > 1
        ? { kind: "choose", count: usable.length }
        : { kind: "none" };
  }
  return previews;
}
