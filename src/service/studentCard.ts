import { CardPurchaseSource, PaymentMethod, Prisma } from "@prisma/client";
import { nextCardSerial } from "@/service/studentCardSerial";

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
  const created = await tx.studentCard.create({
    data: {
      serialNumber: await nextCardSerial(tx, card.classroomId),
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
