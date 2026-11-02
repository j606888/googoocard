import { CardPurchaseSource, PaymentMethod, Prisma } from "@prisma/client";
import { nextCardSerial } from "@/service/studentCardSerial";
import { CARD_EXPIRY_MONTHS } from "@/service/finance/setup";
import { defaultReceiver, isFinanceMember, soldLocationFor } from "@/service/finance/receiver";
import { assertCardSellable, issueGiftCardInTx } from "@/service/finance/bound";
import { addMonthsTaipei, toTaipeiDateKey } from "@/lib/taipei-date";

type CardForPurchase = { id: number; name: string; price: number; classroomId: number };

/**
 * Creates one purchased StudentCard and its「購買課卡」Event inside the caller's
 * transaction — the single place that writes a new card, so the serial, the
 * price fields and the timeline entry can't drift between the teacher's
 * BuyCard, the LIFF「購買課卡」page and buy-at-check-in.
 *
 * A card that's paid at creation records who holds the money (`paidByUserId`);
 * a student-side $0 card (舊生體驗課) is paid with nobody holding anything.
 */
export async function createStudentCardInTx(
  tx: Prisma.TransactionClient,
  {
    studentId,
    card,
    finalPrice,
    sessions,
    purchaseSource,
    purchasedByUserId = null,
    isPaid,
    paidByUserId = null,
    paymentMethod = null,
    paymentReference = null,
    note = null,
    eventDescription,
    lessonLocationId = null,
  }: {
    studentId: number;
    card: CardForPurchase;
    finalPrice: number;
    sessions: number;
    purchaseSource: CardPurchaseSource;
    purchasedByUserId?: number | null;
    isPaid: boolean;
    paidByUserId?: number | null;
    /** 建卡當下就收了錢時（例如登記體驗課）一起記下怎麼付的。 */
    paymentMethod?: PaymentMethod | null;
    paymentReference?: string | null;
    note?: string | null;
    eventDescription: string;
    /** 在課堂裡買的卡：那堂課的分部，找收款人用。 */
    lessonLocationId?: number | null;
  }
) {
  // 系統的「贈送卡」卡種只由 issueGiftCardInTx 發，這裡一律不賣。
  const cardType = await tx.card.findUniqueOrThrow({
    where: { id: card.id },
    select: { isGift: true, boundLessonId: true },
  });
  assertCardSellable(cardType);

  // 財務開啟的教室：卡從台北今天起 6 個月到期（spec §5.2）。
  const classroom = await tx.classroom.findUnique({
    where: { id: card.classroomId },
    select: { financeEnabledAt: true },
  });
  const expiresAt = classroom?.financeEnabledAt
    ? addMonthsTaipei(toTaipeiDateKey(new Date()), CARD_EXPIRY_MONTHS)
    : null;

  // 財務開啟、建卡當下就收了錢：賣卡分部 = 收款人保管的分部。
  // 賣的人不是財務 → 錢記在課所在分部的保管人（找不到 → 400 RECEIVER_REQUIRED）。
  let soldLocationId: number | null = null;
  if (classroom?.financeEnabledAt && isPaid && paidByUserId) {
    if (!(await isFinanceMember(paidByUserId, card.classroomId))) {
      paidByUserId = await defaultReceiver(card.classroomId, paidByUserId, lessonLocationId);
    }
    soldLocationId = await soldLocationFor(card.classroomId, paidByUserId);
  }

  const created = await tx.studentCard.create({
    data: {
      serialNumber: await nextCardSerial(tx, card.classroomId),
      expiresAt,
      studentId,
      cardId: card.id,
      basePrice: card.price,
      finalPrice,
      // total and remaining must match at creation.
      totalSessions: sessions,
      remainingSessions: sessions,
      purchaseSource,
      purchasedByUserId,
      isPaid,
      paidAt: isPaid ? new Date() : null,
      paidByUserId: isPaid ? paidByUserId : null,
      soldLocationId,
      paymentMethod: isPaid ? paymentMethod : null,
      paymentReference: isPaid ? paymentReference : null,
      note,
    },
  });

  await tx.event.create({
    data: {
      title: "購買課卡",
      description: eventDescription,
      studentId,
      resourceType: "studentCard",
      resourceId: created.id,
    },
  });

  // 財務開啟、賣的是綁課卡：同交易附送一張贈送卡（spec §5.5，不等付款）。
  if (classroom?.financeEnabledAt && cardType.boundLessonId !== null) {
    await issueGiftCardInTx(tx, {
      classroomId: card.classroomId,
      studentId,
      boundStudentCard: created,
    });
  }

  return created;
}
