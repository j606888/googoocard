import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { cardSchema } from "@/lib/schemas";
import { requireDanceStyleInClassroom } from "@/lib/authz";
import { danceStyleSummarySelect } from "@/lib/danceStyles";

export const GET = apiRoute(async ({ classroomId }) => {
  // 購買人次與營收只算真的有金流的卡：origin = CONVERSION 是舊卡轉換來的，
  // 錢已經在原始購買時認列過，計進來會讓同一筆錢在兩張卡各算一次。
  // activeHolders 則要含轉換卡 —— 那確實是有效持卡。
  const cardInclude = {
    danceStyle: { select: danceStyleSummarySelect },
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

  // 明列欄位而不是把整列 DB row 攤進回應（見 docs/roadmap.md 的 IDOR 章節）。
  const mapCard = (card: typeof activeCards[0]) => ({
    id: card.id,
    name: card.name,
    price: card.price,
    sessions: card.sessions,
    isPracticeCard: card.isPracticeCard,
    danceStyleId: card.danceStyleId,
    danceStyle: card.danceStyle,
    expiredAt: card.expiredAt,
    createdAt: card.createdAt,
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
  const { name, price, sessions, isPracticeCard, danceStyleId } = await parseBody(
    request,
    cardSchema
  );
  if (danceStyleId) await requireDanceStyleInClassroom(danceStyleId, classroomId);

  return prisma.card.create({
    data: {
      name,
      price,
      sessions,
      classroomId,
      isPracticeCard,
      // General cards may carry a dance style purely as a category label (it
      // does not restrict usage — see cardMatchesLesson). Practice cards require it.
      danceStyleId: danceStyleId ?? null,
    },
    include: { danceStyle: { select: danceStyleSummarySelect } },
  });
});
