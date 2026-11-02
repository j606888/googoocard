import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { isFinanceEnabled } from "@/service/finance/access";
import { nextCardSerial } from "@/service/studentCardSerial";
import { CARD_EXPIRY_MONTHS } from "@/service/finance/setup";
import { addMonthsTaipei, toTaipeiDateKey } from "@/lib/taipei-date";

// 綁課卡、缺席扣格、贈送卡（spec §5.4–5.5）。只在財務開啟的教室生效。

const GIFT_CARD = { name: "贈送卡", price: 0, sessions: 1 } as const;

/**
 * 什麼課都能上的卡：贈送卡，或綁課卡而那門課已經結束（剩格變通用，spec §5.4）。
 * 純函式；`fetchStudentsWithValidCards` 的 SQL 條件跟它同口徑。
 */
export function isUniversalCard(
  sc: { card: { isGift: boolean; boundLessonId: number | null } },
  boundLessonFinished: boolean
): boolean {
  return sc.card.isGift || (sc.card.boundLessonId !== null && boundLessonFinished);
}

/**
 * 賣綁課卡時附送一張贈送卡：1 格、$0、已付款但沒人收錢（paidByUserId null）、
 * 台北今天 + 6 個月到期。卡種「贈送卡」每個教室一張，第一次用到時建。
 * 直接寫 StudentCard、不走 createStudentCardInTx——那裡的收款人規則不適用於 $0 的贈品。
 */
export async function issueGiftCardInTx(
  tx: Prisma.TransactionClient,
  {
    classroomId,
    studentId,
    boundStudentCard,
  }: { classroomId: number; studentId: number; boundStudentCard: { id: number; expiresAt: Date | null } }
) {
  const giftCard =
    (await tx.card.findFirst({
      where: { classroomId, isGift: true },
      orderBy: { id: "asc" },
      select: { id: true },
    })) ??
    (await tx.card.create({
      data: { classroomId, isGift: true, ...GIFT_CARD },
      select: { id: true },
    }));

  return tx.studentCard.create({
    data: {
      serialNumber: await nextCardSerial(tx, classroomId),
      studentId,
      cardId: giftCard.id,
      basePrice: GIFT_CARD.price,
      finalPrice: 0,
      totalSessions: GIFT_CARD.sessions,
      remainingSessions: GIFT_CARD.sessions,
      isPaid: true,
      paidAt: new Date(),
      paidByUserId: null,
      giftFromId: boundStudentCard.id,
      expiresAt: addMonthsTaipei(toTaipeiDateKey(new Date()), CARD_EXPIRY_MONTHS),
    },
  });
}

/**
 * 這次出席名單上、之前被缺席扣過的人：刪掉缺席、把格子退回卡上。要在新增出席
 * **之前**跑，那張綁課卡才有格子可以給這次的出席扣（不會重複扣）。
 */
export async function refundPresentAbsencesInTx(
  tx: Prisma.TransactionClient,
  { lessonPeriodId, presentStudentIds }: { lessonPeriodId: number; presentStudentIds: number[] }
): Promise<number[]> {
  if (presentStudentIds.length === 0) return [];
  const absences = await tx.attendanceAbsence.findMany({
    where: { lessonPeriodId, studentId: { in: presentStudentIds } },
  });
  for (const absence of absences) {
    await refundAbsenceInTx(tx, absence);
  }
  return absences.map((a) => a.studentId);
}

/** 刪一筆缺席並退格（重設點名也用）。 */
export async function refundAbsenceInTx(
  tx: Prisma.TransactionClient,
  absence: { id: number; studentCardId: number; sessionsUsed: number }
) {
  await tx.studentCard.update({
    where: { id: absence.studentCardId },
    data: { remainingSessions: { increment: absence.sessionsUsed } },
  });
  await tx.attendanceAbsence.delete({ where: { id: absence.id } });
}

/**
 * 讓這個時段的缺席扣格跟出席名單一致（財務沒開 → 什麼都不做）：
 *   1. 出席名單上的人有缺席紀錄 → 刪掉、退格（通常已由 refundPresentAbsencesInTx 先做）。
 *   2. 持這門課的綁課卡、沒出席、還沒有缺席紀錄 → 建 AttendanceAbsence、扣
 *      `lesson.sessionsPerAttendance` 格。買卡之前的時段不扣；剩格不夠的卡不扣。
 * 缺席不是出席：不建 AttendanceRecord／LessonStudent／Event。回傳格數有變動的學生。
 */
export async function reconcileAbsencesInTx(
  tx: Prisma.TransactionClient,
  {
    lesson,
    lessonPeriodId,
    presentStudentIds,
  }: {
    lesson: { id: number; classroomId: number; sessionsPerAttendance: number };
    lessonPeriodId: number;
    presentStudentIds: number[];
  }
): Promise<number[]> {
  const classroom = await tx.classroom.findUnique({
    where: { id: lesson.classroomId },
    select: { financeEnabledAt: true },
  });
  if (!classroom?.financeEnabledAt) return [];

  const refunded = await refundPresentAbsencesInTx(tx, { lessonPeriodId, presentStudentIds });

  const period = await tx.lessonPeriod.findUniqueOrThrow({
    where: { id: lessonPeriodId },
    select: { startTime: true },
  });
  const need = Math.max(1, lesson.sessionsPerAttendance);
  const alreadyAbsent = await tx.attendanceAbsence.findMany({
    where: { lessonPeriodId },
    select: { studentId: true },
  });
  const excluded = [...presentStudentIds, ...alreadyAbsent.map((a) => a.studentId)];

  const candidates = await tx.studentCard.findMany({
    where: {
      student: { classroomId: lesson.classroomId },
      studentId: { notIn: excluded },
      card: { boundLessonId: lesson.id },
      expiredAt: null,
      remainingSessions: { gte: need },
      createdAt: { lte: period.startTime },
    },
    orderBy: [{ remainingSessions: "asc" }, { id: "asc" }],
    select: { id: true, studentId: true },
  });

  const deducted: number[] = [];
  for (const sc of candidates) {
    if (deducted.includes(sc.studentId)) continue; // 一人一個時段最多一筆缺席
    // 有條件扣格：併發時卡不會被扣成負數。
    const { count } = await tx.studentCard.updateMany({
      where: { id: sc.id, remainingSessions: { gte: need } },
      data: { remainingSessions: { decrement: need } },
    });
    if (count === 0) continue;
    await tx.attendanceAbsence.create({
      data: { lessonPeriodId, studentId: sc.studentId, studentCardId: sc.id, sessionsUsed: need },
    });
    deducted.push(sc.studentId);
  }
  return [...refunded, ...deducted];
}

/**
 * 卡種表單的 `boundLessonId`：只有財務開啟的教室能設（400 FINANCE_DISABLED），
 * 而且必須是本教室 `kind = "fixed"` 的課（400 BOUND_LESSON_INVALID）。
 * null／undefined 直接放行（清除或不動）。
 */
export async function assertBoundLessonAllowed(
  classroomId: number,
  boundLessonId: number | null | undefined
): Promise<void> {
  if (boundLessonId === null || boundLessonId === undefined) return;
  if (!(await isFinanceEnabled(classroomId))) {
    throw new ApiError(400, "FINANCE_DISABLED", "Bound cards need finance enabled");
  }
  const lesson = await prisma.lesson.findFirst({
    where: { id: boundLessonId, classroomId, kind: "fixed" },
    select: { id: true },
  });
  if (!lesson) {
    throw new ApiError(400, "BOUND_LESSON_INVALID", "Bound lesson must be a fixed lesson in this classroom");
  }
}

/** 綁課卡一定掛在它那門課上（LessonCard），已經掛著就不動。 */
export async function ensureBoundLessonCard(lessonId: number, cardId: number): Promise<void> {
  await prisma.lessonCard.upsert({
    where: { lessonId_cardId: { lessonId, cardId } },
    update: {},
    create: { lessonId, cardId },
  });
}
