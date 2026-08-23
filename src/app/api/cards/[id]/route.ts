import prisma from "@/lib/prisma";
import { apiRoute, parseId, parseBody } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { cardSchema } from "@/lib/schemas";

type Params = { id: string };

export const GET = apiRoute<Params>(async ({ params, classroomId }) => {
  const card = await prisma.card.findFirst({
    where: { id: parseId(params.id, "card id"), classroomId },
    include: {
      // 與卡片列表同口徑：購買人次/營收排除轉換卡（origin = CONVERSION），
      // 因為那筆錢在原始購買時已經認列過。
      _count: { select: { studentCards: { where: { origin: "PURCHASE" } } } },
      studentCards: { where: { origin: "PURCHASE" }, select: { finalPrice: true } },
    },
  });

  if (!card) throw notFound("Card");

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

  return {
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
  };
});

export const DELETE = apiRoute<Params>(async ({ params, classroomId }) => {
  return prisma.card.delete({
    where: { id: parseId(params.id, "card id"), classroomId },
  });
});

export const PATCH = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const cardId = parseId(params.id, "card id");
  const { name, price, sessions, isPracticeCard, danceType } = await parseBody(
    request,
    cardSchema
  );

  // GET and DELETE in this file were already classroom-scoped; PATCH was not,
  // so another classroom's card price and session count were editable.
  const existing = await prisma.card.findFirst({
    where: { id: cardId, classroomId },
    select: { id: true },
  });
  if (!existing) throw notFound("Card");

  return prisma.card.update({
    where: { id: existing.id },
    data: {
      name,
      price,
      sessions,
      isPracticeCard,
      // General cards may carry a danceType as a category label (does not
      // restrict usage). Practice cards require it (guarded by the schema).
      danceType: danceType ?? null,
    },
  });
});
