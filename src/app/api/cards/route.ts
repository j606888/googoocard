import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET() {
  const { classroomId } = await decodeAuthToken();

  const activeCards = await prisma.card.findMany({
    where: {
      classroomId,
      expiredAt: null,
    },
    include: {
      _count: {
        select: {
          studentCards: true
        }
      }
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const expiredCards = await prisma.card.findMany({
    where: {
      classroomId,
      expiredAt: {
        not: null,
      },
    },
    include: {
      _count: {
        select: {
          studentCards: true
        }
      }
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const result = {
    activeCards: activeCards.map((card) => ({ ...card, purchasedCount: card._count.studentCards })),
    expiredCards: expiredCards.map((card) => ({ ...card, purchasedCount: card._count.studentCards })),
  };

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { name, price, sessions } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const card = await prisma.card.create({
    data: { name, price, sessions, classroomId: classroomId! },
  });

  return NextResponse.json(card);
}

