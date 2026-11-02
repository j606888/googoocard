import prisma from "@/lib/prisma";
import { apiRoute, parseId, parseBody } from "@/lib/apiRoute";
import { ApiError, notFound } from "@/lib/apiError";
import { cardSchema } from "@/lib/schemas";
import { requireDanceStyleInClassroom } from "@/lib/authz";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import {
  assertBoundLessonAllowed,
  assertCardSellable,
  ensureBoundLessonCard,
} from "@/service/finance/bound";

type Params = { id: string };

export const GET = apiRoute<Params>(async ({ params, classroomId }) => {
  const card = await prisma.card.findFirst({
    where: { id: parseId(params.id, "card id"), classroomId },
    include: {
      danceStyle: { select: danceStyleSummarySelect },
      // 與卡片列表同口徑：購買人次/營收排除轉換卡（origin = CONVERSION），
      // 因為那筆錢在原始購買時已經認列過。
      _count: { select: { studentCards: { where: { origin: "PURCHASE" } } } },
      studentCards: { where: { origin: "PURCHASE" }, select: { finalPrice: true, basePrice: true } },
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
      isGift: card.isGift,
      boundLessonId: card.boundLessonId,
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
    issuedPrices: issuedPrices(card.studentCards),
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

/**
 * 已發出的卡依「當時的牌價」（basePrice）分組——改價只影響之後的購買，
 * 這份清單讓老師看得到手上那些卡還是照舊價算的。轉換卡不算（同營收口徑）。
 * 張數多的在前，同張數時新價（較高）在前。
 */
function issuedPrices(studentCards: { basePrice: number }[]) {
  const counts = new Map<number, number>();
  for (const { basePrice } of studentCards) {
    counts.set(basePrice, (counts.get(basePrice) ?? 0) + 1);
  }
  return [...counts]
    .map(([price, count]) => ({ price, count }))
    .sort((a, b) => b.count - a.count || b.price - a.price);
}

export const DELETE = apiRoute<Params>(async ({ params, classroomId }) => {
  return prisma.card.delete({
    where: { id: parseId(params.id, "card id"), classroomId },
  });
});

export const PATCH = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const cardId = parseId(params.id, "card id");
  const { name, price, sessions, isPracticeCard, isTrial, danceStyleId, boundLessonId } =
    await parseBody(request, cardSchema);

  // GET and DELETE in this file were already classroom-scoped; PATCH was not,
  // so another classroom's card price and session count were editable.
  const existing = await prisma.card.findFirst({
    where: { id: cardId, classroomId },
    select: { id: true, isGift: true, boundLessonId: true, _count: { select: { studentCards: true } } },
  });
  if (!existing) throw notFound("Card");
  assertCardSellable(existing);
  if (danceStyleId) await requireDanceStyleInClassroom(danceStyleId, classroomId);

  const bindingChanged = boundLessonId !== undefined && boundLessonId !== existing.boundLessonId;
  // 已經賣出的綁課卡不能改綁定：持卡人的缺席扣格、贈送卡都是照買的時候的綁定算的。
  if (bindingChanged && existing._count.studentCards > 0) {
    throw new ApiError(400, "BOUND_LESSON_LOCKED", "Cards of this type were already issued");
  }
  const effectiveBinding = boundLessonId === undefined ? existing.boundLessonId : boundLessonId;
  if (!bindingChanged && effectiveBinding !== null && (isPracticeCard || isTrial)) {
    throw new ApiError(400, "BOUND_LESSON_INVALID", "Only general cards can be bound to a lesson");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (bindingChanged) {
      await assertBoundLessonAllowed(tx, classroomId, boundLessonId, { isPracticeCard, isTrial });
    }
    const card = await tx.card.update({
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
        // undefined（舊表單沒送）= 不動。
        ...(bindingChanged ? { boundLessonId } : {}),
      },
      include: { danceStyle: { select: danceStyleSummarySelect } },
    });
    if (bindingChanged && card.boundLessonId !== null) {
      await ensureBoundLessonCard(tx, card.boundLessonId, card.id);
    }
    return card;
  });
  return updated;
});
