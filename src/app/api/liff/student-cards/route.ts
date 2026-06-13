import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";
import { canBuyCard } from "@/domains/qualification";
import { refreshNeedsRenewalTag } from "@/service/studentTag";

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
  if (!card || card.classroomId !== student.classroomId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Re-enforce qualification server-side (the client also hides these cards).
  if (card.isPracticeCard) {
    const qualifications = await prisma.studentDanceQualification.findMany({
      where: { studentId: student.id },
    });
    const decision = canBuyCard(
      card,
      qualifications.map((q) => q.danceType),
    );
    if (!decision.allowed) {
      return NextResponse.json({ error: "STUDENT_NOT_QUALIFIED" }, { status: 403 });
    }
  }

  const studentCard = await prisma.studentCard.create({
    data: {
      studentId: student.id,
      cardId: card.id,
      basePrice: card.price,
      finalPrice: card.price,
      totalSessions: card.sessions,
      remainingSessions: card.sessions,
      purchaseSource: "STUDENT",
      purchasedByUserId: null,
      isPaid: false,
      paidAt: null,
      paidByUserId: null,
    },
  });

  await prisma.event.create({
    data: {
      title: "購買課卡",
      description: `學生自助購買課卡 ${card.name}（待付款）`,
      studentId: student.id,
      resourceType: "studentCard",
      resourceId: studentCard.id,
    },
  });

  await refreshNeedsRenewalTag(student.id, card.classroomId);

  return NextResponse.json(studentCard);
}
