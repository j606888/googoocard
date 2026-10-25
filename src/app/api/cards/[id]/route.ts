import prisma from "@/lib/prisma";
import { apiRoute, parseId, parseBody } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { cardSchema } from "@/lib/schemas";
import { requireDanceStyleInClassroom } from "@/lib/authz";
import { danceStyleSummarySelect } from "@/lib/danceStyles";

type Params = { id: string };

export const GET = apiRoute<Params>(async ({ params, classroomId }) => {
  const card = await prisma.card.findFirst({
    where: { id: parseId(params.id, "card id"), classroomId },
    include: {
      danceStyle: { select: danceStyleSummarySelect },
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

  return {
    // Whitelisted, not spread — see docs/roadmap.md "never spread a DB row".
    card: {
      id: card.id,
      name: card.name,
      price: card.price,
      sessions: card.sessions,
      isPracticeCard: card.isPracticeCard,
    isTrial: card.isTrial,
      danceStyleId: card.danceStyleId,
      danceStyle: card.danceStyle,
      expiredAt: card.expiredAt,
      classroomId: card.classroomId,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    },
    purchasedCount: card._count.studentCards,
    activeHolderCount: holderCards.length,
    totalRevenue: card.studentCards.reduce((sum, sc) => sum + sc.finalPrice, 0),
    holders: holderCards.map((sc) => ({
      id: sc.id,
      serialNumber: sc.serialNumber,
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
  const { name, price, sessions, isPracticeCard, isTrial, danceStyleId } = await parseBody(
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
  if (danceStyleId) await requireDanceStyleInClassroom(danceStyleId, classroomId);

  return prisma.card.update({
    where: { id: existing.id },
    data: {
      name,
      price,
      sessions,
      isPracticeCard,
      isTrial,
      // General cards may carry a dance style as a category label (does not
      // restrict usage). Practice cards require it (guarded by the schema).
      danceStyleId: danceStyleId ?? null,
    },
    include: { danceStyle: { select: danceStyleSummarySelect } },
  });
});
