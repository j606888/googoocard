import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { canBuyCard } from "@/domains/qualification";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const studentCards = await prisma.studentCard.findMany({
    where: {
      studentId: parseInt(id),
    },
  });

  return NextResponse.json(studentCards);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cardId, sessions, price, lessonId } = await request.json();

  const card = await prisma.card.findUnique({
    where: {
      id: cardId,
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (card.isPracticeCard) {
    const qualifications = await prisma.studentDanceQualification.findMany({
      where: { studentId: parseInt(id) },
    });
    const lesson = lessonId
      ? await prisma.lesson.findUnique({ where: { id: lessonId } })
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

  const studentCard = await prisma.studentCard.create({
    data: {
      studentId: parseInt(id),
      cardId,
      basePrice: card.price,
      finalPrice: price,
      totalSessions: card.sessions,
      remainingSessions: sessions,
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