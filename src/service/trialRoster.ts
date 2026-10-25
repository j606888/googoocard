import type { z } from "zod";
import prisma from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/apiError";
import { defaultTrialPrice } from "@/lib/trialPrice";
import { formatMoney } from "@/lib/money";
import type { registerTrialSchema } from "@/lib/schemas";
import { createStudent, DEFAULT_STUDENT_AVATAR } from "@/service/student";
import { createStudentCardInTx } from "@/service/studentCard";
import { isReturningStudent } from "@/service/trial";

/**
 * 體驗名單：老師把報名體驗的人（Google Form、現場）登記在體驗課上，
 * 上課前就收費。沒有另外的資料表——一筆報名就是一張這堂課收的體驗卡
 * （`Card.isTrial`）的 StudentCard：
 *   - 還沒用掉（剩餘堂數 > 0）= 已報名、還沒來上課；點名時預先勾好，
 *     點名引擎會優先扣這張（`cardOptionsFor`）。
 *   - 用在這堂課的某個時段 = 已上課。
 * 學生端（LIFF 自助簽到）不賣體驗卡。
 */

/** 已上課的只列最近這麼多筆——持續開的體驗課會一直累積。 */
const ATTENDED_LIMIT = 30;

const PAYMENT_LABEL = { CASH: "現金", TRANSFER: "轉帳" } as const;

async function trialCardsOf(lessonId: number, classroomId: number) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, classroomId },
    select: { cards: { select: { card: true } } },
  });
  if (!lesson) throw notFound("Lesson");
  return lesson.cards.map((lc) => lc.card).filter((card) => card.isTrial);
}

export async function getTrialRoster(lessonId: number, classroomId: number) {
  const trialCards = await trialCardsOf(lessonId, classroomId);
  const cardIds = trialCards.map((card) => card.id);
  if (cardIds.length === 0) return { trialCards: [], entries: [] };

  const include = {
    student: { select: { id: true, name: true, avatarUrl: true } },
    card: { select: { name: true } },
    attendanceRecords: {
      where: { lessonPeriod: { lessonId } },
      select: { lessonPeriod: { select: { startTime: true } } },
      take: 1,
    },
  } as const;
  const base = { cardId: { in: cardIds }, student: { classroomId, archivedAt: null } };

  const [registered, attended] = await Promise.all([
    prisma.studentCard.findMany({
      where: { ...base, remainingSessions: { gt: 0 }, expiredAt: null },
      include,
      orderBy: { createdAt: "asc" },
    }),
    prisma.studentCard.findMany({
      where: {
        ...base,
        remainingSessions: 0,
        attendanceRecords: { some: { lessonPeriod: { lessonId } } },
      },
      include,
      orderBy: { createdAt: "desc" },
      take: ATTENDED_LIMIT,
    }),
  ]);

  const toEntry =
    (status: "registered" | "attended") => (sc: (typeof registered)[number]) => ({
      studentCardId: sc.id,
      serialNumber: sc.serialNumber,
      status,
      student: sc.student,
      cardName: sc.card.name,
      finalPrice: sc.finalPrice,
      isPaid: sc.isPaid,
      paymentMethod: sc.paymentMethod,
      registeredAt: sc.createdAt,
      attendedAt: sc.attendanceRecords[0]?.lessonPeriod.startTime ?? null,
    });

  return {
    trialCards: trialCards
      .filter((card) => !card.expiredAt)
      .map((card) => ({ id: card.id, name: card.name, price: card.price })),
    entries: [...registered.map(toEntry("registered")), ...attended.map(toEntry("attended"))],
  };
}

export async function registerTrial({
  lessonId,
  classroomId,
  userId,
  input,
}: {
  lessonId: number;
  classroomId: number;
  userId: number;
  input: z.infer<typeof registerTrialSchema>;
}) {
  const trialCards = await trialCardsOf(lessonId, classroomId);
  const card = trialCards.find((c) => c.id === input.cardId && !c.expiredAt);
  if (!card) throw badRequest("CARD_NOT_OFFERED", "Not an active trial card of this lesson");

  let studentId: number;
  if (input.studentId !== undefined) {
    const existing = await prisma.student.findFirst({
      where: { id: input.studentId, classroomId, archivedAt: null },
      select: { id: true },
    });
    if (!existing) throw notFound("Student");
    const pending = await prisma.studentCard.count({
      where: { studentId: existing.id, cardId: card.id, remainingSessions: { gt: 0 }, expiredAt: null },
    });
    if (pending > 0) throw badRequest("ALREADY_REGISTERED", "Student already has this trial card");
    studentId = existing.id;
  } else {
    // 同名不擋——跟自助登記一樣交給待處理的「可能重複」與合併學員。
    const created = await createStudent(classroomId, {
      name: input.newStudentName!,
      avatarUrl: DEFAULT_STUDENT_AVATAR,
    });
    studentId = created.id;
  }

  const finalPrice =
    input.finalPrice ?? defaultTrialPrice(card, await isReturningStudent(studentId));
  const isPaid = finalPrice === 0 || input.isPaid;
  const paymentMethod = isPaid && finalPrice > 0 ? input.paymentMethod ?? null : null;
  const paymentReference = paymentMethod === "TRANSFER" ? input.paymentReference || null : null;

  return prisma.$transaction((tx) =>
    createStudentCardInTx(tx, {
      studentId,
      card,
      finalPrice,
      sessions: card.sessions,
      purchaseSource: "STAFF",
      purchasedByUserId: userId,
      isPaid,
      paidByUserId: isPaid && finalPrice > 0 ? userId : null,
      paymentMethod,
      paymentReference,
      eventDescription: [
        `登記體驗 ${card.name}（$${formatMoney(finalPrice)}）`,
        finalPrice === 0 ? "免費" : isPaid ? "已收款" : "待付款",
        paymentMethod && PAYMENT_LABEL[paymentMethod],
      ]
        .filter(Boolean)
        .join(" · "),
    })
  );
}
