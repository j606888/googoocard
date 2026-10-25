import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * 舊生 = has bought any non-trial card in this classroom (cards never cross
 * classrooms, so the student's own cards are enough). A student who only ever
 * came to a trial class is still a newcomer next time.
 */
export async function isReturningStudent(studentId: number, db: Db = prisma) {
  const count = await db.studentCard.count({
    where: { studentId, card: { isTrial: false } },
  });
  return count > 0;
}

/**
 * What a student pays for a card picked at self check-in: a trial card is free
 * for 舊生 (they're tagging along, not trying the studio), list price for
 * everyone else. Staff can still change `finalPrice` by hand afterwards.
 */
export function selfServicePrice(card: { price: number; isTrial: boolean }, returning: boolean) {
  return card.isTrial && returning ? 0 : card.price;
}
