import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";
import { canBuyCard, toDanceLevels } from "@/domains/qualification";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { createStudentCardInTx } from "@/service/studentCard";
import { notifyClassroom } from "@/service/push";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatMoney } from "@/lib/money";

// Student self-service card purchase from the LIFF「購買課卡」page (trust-open):
// creates a real, immediately-usable StudentCard marked unpaid
// (purchaseSource STUDENT, isPaid false). The teacher later confirms payment in
// the backoffice unpaid list. Auth is a LIFF ID token; ownership is enforced via
// resolveOwnedStudent. Sessions/price are fixed to the card's own values — the
// student cannot edit them.
export async function POST(request: Request) {
  const { studentId, cardId } = await request.json();

  const resolved = await resolveOwnedStudent(bearerToken(request), studentId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { student } = resolved;

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  // Trial cards are only offered inside check-in, where the price depends on
  // whether the student is new (src/service/trial.ts).
  if (!card || card.classroomId !== student.classroomId || card.isTrial) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Re-enforce qualification server-side (the client also hides these cards).
  if (card.isPracticeCard) {
    const qualifications = await prisma.studentDanceQualification.findMany({
      where: { studentId: student.id },
    });
    const decision = canBuyCard(
      card,
      toDanceLevels(qualifications),
    );
    if (!decision.allowed) {
      return NextResponse.json({ error: "STUDENT_NOT_QUALIFIED" }, { status: 403 });
    }
  }

  // Card, serial and purchase Event are one unit of work: the serial counter
  // must only advance for a card that actually exists.
  const studentCard = await prisma.$transaction((tx) =>
    createStudentCardInTx(tx, {
      studentId: student.id,
      card,
      finalPrice: card.price,
      sessions: card.sessions,
      purchaseSource: "STUDENT",
      isPaid: false,
      eventDescription: `學生自助購買課卡 ${card.name}（待付款）`,
    })
  );

  await refreshNeedsRenewalTag(student.id, card.classroomId);

  await notifyClassroom(card.classroomId, {
    type: "UNPAID_CARD",
    title: "待確認收款",
    body: `${student.name} 自助購買了「${card.name}」${formatCardSerial(studentCard.serialNumber)}，NT$${formatMoney(card.price)}`,
    path: `/students/${student.id}`,
  });

  return NextResponse.json(studentCard);
}
