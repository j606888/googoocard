import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { cardSchema } from "@/lib/schemas";

export const GET = apiRoute(async ({ classroomId }) => {
  // 購買人次與營收只算真的有金流的卡：origin = CONVERSION 是舊卡轉換來的，
  // 錢已經在原始購買時認列過，計進來會讓同一筆錢在兩張卡各算一次。
  // activeHolders 則要含轉換卡 —— 那確實是有效持卡。
  const cardInclude = {
    _count: { select: { studentCards: { where: { origin: "PURCHASE" as const } } } },
    studentCards: {
      select: {
        finalPrice: true,
        remainingSessions: true,
        expiredAt: true as const,
        origin: true,
      },
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
    totalRevenue: card.studentCards
      .filter((sc) => sc.origin === "PURCHASE")
      .reduce((sum, sc) => sum + sc.finalPrice, 0),
  });

  return {
    activeCards: activeCards.map(mapCard),
    expiredCards: expiredCards.map(mapCard),
  };
});

export const POST = apiRoute(async ({ request, classroomId }) => {
  // The practice-card-requires-a-dance-type rule now lives in the schema, so
  // POST and PATCH can't drift apart on it.
  const { name, price, sessions, isPracticeCard, danceType } = await parseBody(
    request,
    cardSchema
  );

  return prisma.card.create({
    data: {
      name,
      price,
      sessions,
      classroomId,
      isPracticeCard,
      // General cards may carry a danceType purely as a category label (it does
      // not restrict usage — see cardMatchesLesson). Practice cards require it.
      danceType: danceType ?? null,
    },
  });
});
