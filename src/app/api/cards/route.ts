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
  });

  const expiredCards = await prisma.card.findMany({
    where: {
      classroomId,
      expiredAt: {
        not: null,
      },
    },
  });
  return NextResponse.json({ activeCards, expiredCards });
}

export async function POST(request: Request) {
  const { name, price, sessions } = await request.json();
  const { classroomId } = await decodeAuthToken();

  const card = await prisma.card.create({
    data: { name, price, sessions, classroomId: classroomId! },
  });

  return NextResponse.json(card);
}

