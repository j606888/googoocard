import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const cardInclude = {
    _count: { select: { studentCards: true } },
    studentCards: {
      select: { finalPrice: true, remainingSessions: true, expiredAt: true as const },
    },
  };

  const activeCards = await prisma.card.findMany({
    where: { classroomId, expiredAt: null },
    include: cardInclude,
    orderBy: { createdAt: "desc" },
  });

  const expiredCards = await prisma.card.findMany({
    where: { classroomId, expiredAt: { not: null } },
    include: cardInclude,
    orderBy: { createdAt: "desc" },
  });

  const mapCard = (card: typeof activeCards[0]) => ({
    ...card,
    studentCards: undefined,
    purchasedCount: card._count.studentCards,
    activeHolders: card.studentCards.filter((sc) => sc.remainingSessions > 0 && !sc.expiredAt).length,
    totalRevenue: card.studentCards.reduce((sum, sc) => sum + sc.finalPrice, 0),
  });

  const result = {
    activeCards: activeCards.map(mapCard),
    expiredCards: expiredCards.map(mapCard),
  };

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { name, price, sessions, isPracticeCard } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const card = await prisma.card.create({
    data: { name, price, sessions, classroomId: classroomId!, isPracticeCard },
  });

  return NextResponse.json(card);
}

