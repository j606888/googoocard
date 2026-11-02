import { CardPurchaseSource, PaymentMethod, Prisma } from "@prisma/client";
import { nextCardSerial } from "@/service/studentCardSerial";
import { CARD_EXPIRY_MONTHS } from "@/service/finance/setup";
import { assertReceiverIsFinance, soldLocationFor } from "@/service/finance/receiver";
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
  }
) {
  // 財務開啟的教室：卡從台北今天起 6 個月到期（spec §5.2）。
  const classroom = await tx.classroom.findUnique({
    where: { id: card.classroomId },
    select: { financeEnabledAt: true },
  });
  const expiresAt = classroom?.financeEnabledAt
    ? addMonthsTaipei(toTaipeiDateKey(new Date()), CARD_EXPIRY_MONTHS)
    : null;

  // 財務開啟、建卡當下就收了錢：收款人必須是財務成員，賣卡分部 = 收款人保管的分部。
  let soldLocationId: number | null = null;
  if (classroom?.financeEnabledAt && isPaid && paidByUserId) {
    await assertReceiverIsFinance(paidByUserId, card.classroomId);
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

  return created;
}
