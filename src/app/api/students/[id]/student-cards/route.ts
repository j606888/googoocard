import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
  const { cardId, sessions, price } = await request.json();

  const card = await prisma.card.findUnique({
    where: {
      id: cardId,
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
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
  })

  return NextResponse.json(studentCard);
}