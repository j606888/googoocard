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
  const { cardId, sessions, price, paid } = await request.json();

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
      paid,
    },
  });

  return NextResponse.json(studentCard);
}