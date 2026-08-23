import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { findStudentInClassroom } from "@/lib/authz";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { canBuyCard } from "@/domains/qualification";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  // Ran with no auth at all until 2026-08-23 — any card balance was readable
  // by incrementing the student id.
  const student = await findStudentInClassroom(parseInt(id), classroomId);
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const studentCards = await prisma.studentCard.findMany({
    where: {
      studentId: student.id,
    },
  });

  return NextResponse.json(studentCards);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, classroomId } = await decodeAuthToken();
  const { cardId, sessions, price, lessonId, isPaid = true } = await request.json();

  const student = await findStudentInClassroom(parseInt(id), classroomId);
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // The card must be the caller's own classroom's too, or a card id from
  // another classroom could be attached to this student.
  const card = await prisma.card.findFirst({
    where: {
      id: cardId,
      classroomId,
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (card.isPracticeCard) {
    const qualifications = await prisma.studentDanceQualification.findMany({
      where: { studentId: parseInt(id) },
    });
    // Scoped: the lesson supplies the dance type that decides qualification,
    // so a foreign lesson id must not be able to unlock a practice card.
    const lesson = lessonId
      ? await prisma.lesson.findFirst({ where: { id: lessonId, classroomId } })
      : null;

    const decision = canBuyCard(
      card,
      qualifications.map((q) => q.danceType),
      lesson?.danceType
    );
    if (!decision.allowed) {
      if (decision.reason === "NOT_QUALIFIED") {
        return NextResponse.json({ error: "STUDENT_NOT_QUALIFIED" }, { status: 403 });
      }
      return NextResponse.json({ error: "CARD_MISSING_DANCE_TYPE" }, { status: 422 });
    }
  }

  const paid = isPaid !== false;
  const studentCard = await prisma.studentCard.create({
    data: {
      studentId: parseInt(id),
      cardId,
      basePrice: card.price,
      finalPrice: price,
      // total and remaining must match at creation; both follow the (editable)
      // session count chosen at purchase, defaulting to the card's own sessions.
      totalSessions: sessions,
      remainingSessions: sessions,
      purchaseSource: "STAFF",
      purchasedByUserId: userId ?? null,
      isPaid: paid,
      // When paid at point of sale, the seller is also the payment confirmer.
      paidAt: paid ? new Date() : null,
      paidByUserId: paid ? userId ?? null : null,
    },
  });

  await prisma.event.create({
    data: {
      title: "購買課卡",
      description: `購買新課卡 ${card.name}`,
      studentId: parseInt(id),
      resourceType: "studentCard",
      resourceId: studentCard.id,
    }
  });

  await refreshNeedsRenewalTag(parseInt(id), card.classroomId);

  return NextResponse.json(studentCard);
}