import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/apiError";
import { createStudent, DEFAULT_STUDENT_AVATAR } from "@/service/student";

/**
 * 預計會來（`PeriodBooking`，2026-11-24）：老師事先登記「這位學生這幾堂會來」。
 *
 * - **跟付費無關**：單堂、課卡、還沒付、還沒決定都能登記；付費照舊在點名時處理。
 * - **跟點名分開**：點名頁標「預計今天會到」但**不預設勾選**；事後看得出誰預約了沒來。
 * - 只能登記**還沒點名**的堂；不進正式名單（`LessonStudent`），不進待處理，不記學生動態。
 * - 整期學生不用另外預約（報了整期就算每堂預計會到，請假的除外）。
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** 一位預約學生在某一堂的狀態。`walk_in` = 沒預約但來了；null = 沒預約也沒來。 */
export type BookingStatus = "booked" | "present" | "no_show" | "walk_in" | null;

async function loadLesson(lessonId: number, classroomId: number) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, classroomId },
    select: { id: true },
  });
  if (!lesson) throw notFound("Lesson");
  return lesson;
}

function orderedPeriods(db: Db, lessonId: number) {
  return db.lessonPeriod.findMany({
    where: { lessonId },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
    select: { id: true, startTime: true, attendanceTakenAt: true },
  });
}

/** 既有學生（在籍）或直接打名字建一位新的（同名不擋，交給待處理「可能重複」）。 */
async function resolveStudent(
  classroomId: number,
  who: { studentId?: number; newStudentName?: string }
): Promise<number> {
  if (who.studentId !== undefined) {
    const existing = await prisma.student.findFirst({
      where: { id: who.studentId, classroomId, archivedAt: null },
      select: { id: true },
    });
    if (!existing) throw notFound("Student");
    return existing.id;
  }
  const created = await createStudent(classroomId, {
    name: who.newStudentName!,
    avatarUrl: DEFAULT_STUDENT_AVATAR,
  });
  return created.id;
}

/** 課程頁「預計會來」：每位有預約的學生，每一堂的狀態。 */
export async function getBookingRoster(lessonId: number, classroomId: number) {
  await loadLesson(lessonId, classroomId);
  const [periods, bookings] = await Promise.all([
    orderedPeriods(prisma, lessonId),
    prisma.periodBooking.findMany({
      where: { lessonPeriod: { lessonId } },
      orderBy: { createdAt: "asc" },
      select: {
        lessonPeriodId: true,
        note: true,
        student: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
  ]);
  const studentIds = [...new Set(bookings.map((b) => b.student.id))];
  const attended = await prisma.attendanceRecord.findMany({
    where: { lessonPeriod: { lessonId }, studentId: { in: studentIds } },
    select: { studentId: true, lessonPeriodId: true },
  });
  const attendedKey = new Set(attended.map((r) => `${r.studentId}:${r.lessonPeriodId}`));

  const byStudent = new Map<
    number,
    { student: (typeof bookings)[number]["student"]; note: string | null; bookedPeriodIds: Set<number> }
  >();
  for (const b of bookings) {
    const entry = byStudent.get(b.student.id) ?? { student: b.student, note: null, bookedPeriodIds: new Set() };
    entry.bookedPeriodIds.add(b.lessonPeriodId);
    entry.note = entry.note ?? b.note;
    byStudent.set(b.student.id, entry);
  }

  return {
    periods: periods.map((p, index) => ({
      id: p.id,
      index,
      startTime: p.startTime,
      attendanceTaken: p.attendanceTakenAt !== null,
    })),
    students: [...byStudent.values()].map(({ student, note, bookedPeriodIds }) => {
      const statuses: BookingStatus[] = periods.map((p) => {
        const came = attendedKey.has(`${student.id}:${p.id}`);
        if (!bookedPeriodIds.has(p.id)) return came ? "walk_in" : null;
        if (came) return "present";
        return p.attendanceTakenAt ? "no_show" : "booked";
      });
      return {
        student,
        note,
        statuses,
        counts: {
          booked: statuses.filter((s) => s === "booked").length,
          present: statuses.filter((s) => s === "present").length,
          noShow: statuses.filter((s) => s === "no_show").length,
        },
      };
    }),
  };
}

/**
 * 登記／修改一位學生這門課的預約：**還沒點名的堂**改成剛好是 `periodIds`（多的刪、少的補），
 * 點過名的堂不動（那是紀錄）。`periodIds` 只能是這門課、還沒點名的時段。
 */
export async function setStudentBookings({
  lessonId,
  classroomId,
  userId,
  who,
  periodIds,
  note,
}: {
  lessonId: number;
  classroomId: number;
  userId: number;
  who: { studentId?: number; newStudentName?: string };
  periodIds: number[];
  note?: string | null;
}) {
  await loadLesson(lessonId, classroomId);
  const periods = await orderedPeriods(prisma, lessonId);
  const open = new Set(periods.filter((p) => p.attendanceTakenAt === null).map((p) => p.id));
  const wanted = [...new Set(periodIds)];
  if (wanted.some((id) => !open.has(id))) {
    throw badRequest("PERIOD_NOT_OPEN", "Only this lesson's periods without attendance can be booked");
  }
  if (who.newStudentName !== undefined && wanted.length === 0) {
    throw badRequest("NO_PERIODS", "Pick at least one period");
  }
  const studentId = await resolveStudent(classroomId, who);
  const cleanNote = note?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.periodBooking.deleteMany({
      where: { studentId, lessonPeriodId: { in: [...open].filter((id) => !wanted.includes(id)) } },
    });
    if (wanted.length > 0) {
      await tx.periodBooking.createMany({
        data: wanted.map((lessonPeriodId) => ({ lessonPeriodId, studentId, note: cleanNote, createdByUserId: userId })),
        skipDuplicates: true,
      });
      // 備註是「這個人這門課」的，已經有的那幾堂一起更新。
      await tx.periodBooking.updateMany({
        where: { studentId, lessonPeriodId: { in: wanted } },
        data: { note: cleanNote },
      });
    }
  });
  return { studentId };
}

/** 點名頁「＋ 預計會來」：只登記這一堂（已經有就只更新備註）。 */
export async function bookPeriod({
  lessonId,
  periodId,
  classroomId,
  userId,
  who,
  note,
}: {
  lessonId: number;
  periodId: number;
  classroomId: number;
  userId: number;
  who: { studentId?: number; newStudentName?: string };
  note?: string | null;
}) {
  await loadLesson(lessonId, classroomId);
  const period = await prisma.lessonPeriod.findFirst({
    where: { id: periodId, lessonId },
    select: { id: true, attendanceTakenAt: true },
  });
  if (!period) throw notFound("Lesson period");
  if (period.attendanceTakenAt) {
    throw badRequest("PERIOD_NOT_OPEN", "This period's attendance is already taken");
  }
  const studentId = await resolveStudent(classroomId, who);
  const cleanNote = note?.trim() || null;
  await prisma.periodBooking.upsert({
    where: { lessonPeriodId_studentId: { lessonPeriodId: periodId, studentId } },
    update: { note: cleanNote },
    create: { lessonPeriodId: periodId, studentId, note: cleanNote, createdByUserId: userId },
  });
  return { studentId };
}

/** 點名頁：這一堂預計會來的人（不含整期——整期另有一區）。 */
export async function getPeriodBookings(lessonId: number, periodId: number, classroomId: number) {
  await loadLesson(lessonId, classroomId);
  const bookings = await prisma.periodBooking.findMany({
    where: { lessonPeriodId: periodId, lessonPeriod: { lessonId } },
    orderBy: { createdAt: "asc" },
    select: { note: true, student: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return { bookings };
}

/** 合併學員（交易內）：source 的預約搬到 target；同一堂兩邊都有就留 target 的。 */
export async function moveBookingsInTx(tx: Prisma.TransactionClient, sourceId: number, targetId: number) {
  const targetPeriods = new Set(
    (await tx.periodBooking.findMany({ where: { studentId: targetId }, select: { lessonPeriodId: true } })).map(
      (b) => b.lessonPeriodId
    )
  );
  await tx.periodBooking.deleteMany({
    where: { studentId: sourceId, lessonPeriodId: { in: [...targetPeriods] } },
  });
  await tx.periodBooking.updateMany({ where: { studentId: sourceId }, data: { studentId: targetId } });
}
