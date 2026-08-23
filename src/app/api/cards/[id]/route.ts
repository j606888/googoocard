import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { classroomId } = await decodeAuthToken();

  const card = await prisma.card.findFirst({
    where: { id: Number(id), classroomId },
    include: {
      // 與卡片列表同口徑：購買人次/營收排除轉換卡（origin = CONVERSION），
      // 因為那筆錢在原始購買時已經認列過。
      _count: { select: { studentCards: { where: { origin: "PURCHASE" } } } },
      studentCards: { where: { origin: "PURCHASE" }, select: { finalPrice: true } },
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Holders = student cards that still have sessions left and aren't expired,
  // matching the "active" predicate used in the aggregate list (api/cards/route.ts).
  const holderCards = await prisma.studentCard.findMany({
    where: { cardId: card.id, remainingSessions: { gt: 0 }, expiredAt: null },
    include: {
      student: { select: { id: true, name: true, avatarUrl: true } },
      purchasedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const { _count, studentCards, ...cardFields } = card;

  return NextResponse.json({
    card: cardFields,
    purchasedCount: _count.studentCards,
    activeHolderCount: holderCards.length,
    totalRevenue: studentCards.reduce((sum, sc) => sum + sc.finalPrice, 0),
    holders: holderCards.map((sc) => ({
      id: sc.id,
      studentId: sc.studentId,
      createdAt: sc.createdAt,
      remainingSessions: sc.remainingSessions,
      totalSessions: sc.totalSessions,
      finalPrice: sc.finalPrice,
      isPaid: sc.isPaid,
      paidAt: sc.paidAt,
      student: sc.student,
      purchasedBy: sc.purchasedBy,
    })),
  });
}

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
  const { classroomId } = await decodeAuthToken();
  const { name, price, sessions, isPracticeCard, danceType } = await request.json();

  if (isPracticeCard && !danceType) {
    return NextResponse.json({ error: "PRACTICE_CARD_REQUIRES_DANCE_TYPE" }, { status: 400 });
  }

  // GET and DELETE in this file were already classroom-scoped; PATCH was not,
  // so another classroom's card price and session count were editable.
  const existing = await prisma.card.findFirst({
    where: { id: Number(id), classroomId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = await prisma.card.update({
    where: { id: existing.id },
    data: {
      name,
      price,
      sessions,
      isPracticeCard,
      // General cards may carry a danceType as a category label (does not
      // restrict usage). Practice cards require it (guarded above).
      danceType: danceType ?? null,
    },
  });

  return NextResponse.json(card);
}
