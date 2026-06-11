import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  const card = await prisma.card.delete({
    where: { id: Number(id), classroomId },
  });

  return NextResponse.json(card);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, price, sessions, isPracticeCard, danceType } = await request.json();

  if (isPracticeCard && !danceType) {
    return NextResponse.json({ error: "PRACTICE_CARD_REQUIRES_DANCE_TYPE" }, { status: 400 });
  }

  const card = await prisma.card.update({
    where: { id: Number(id) },
    data: {
      name,
      price,
      sessions,
      isPracticeCard,
      danceType: isPracticeCard ? danceType : null,
    },
  });

  return NextResponse.json(card);
}
