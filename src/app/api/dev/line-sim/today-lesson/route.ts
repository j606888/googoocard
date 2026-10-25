import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { isLineMockEnabled } from "@/lib/lineMock";
import { toTaipeiDateKey } from "@/lib/taipei-date";

const HOUR = 60 * 60 * 1000;

// 模擬器的「建一堂今天的測試課」：兩個時段（這個整點起、各一小時），掛上一般卡與
// 體驗課卡——沒有就各建一張測試卡。只在模擬模式開放。
export const POST = apiRoute(async ({ classroomId }) => {
  if (!isLineMockEnabled()) throw notFound("Route");

  const lesson = await prisma.$transaction(async (tx) => {
    const style =
      (await tx.danceStyle.findFirst({
        where: { classroomId, archivedAt: null },
        orderBy: { sortOrder: "asc" },
      })) ?? (await tx.danceStyle.create({ data: { classroomId, name: "測試舞種", color: "slate" } }));

    const activeCard = { classroomId, expiredAt: null };
    const general =
      (await tx.card.findFirst({ where: { ...activeCard, isTrial: false, isPracticeCard: false } })) ??
      (await tx.card.create({ data: { classroomId, name: "測試 4 堂卡", price: 2000, sessions: 4 } }));
    const trial =
      (await tx.card.findFirst({ where: { ...activeCard, isTrial: true } })) ??
      (await tx.card.create({ data: { classroomId, name: "測試體驗課", price: 400, sessions: 1, isTrial: true } }));

    const first = new Date(Math.floor(Date.now() / HOUR) * HOUR);
    const today = toTaipeiDateKey(first);
    const starts = [first, new Date(first.getTime() + HOUR)].filter((d) => toTaipeiDateKey(d) === today);

    return tx.lesson.create({
      data: {
        classroomId,
        name: `測試課 ${today.slice(5).replace("-", "/")}`,
        kind: "fixed",
        level: 1,
        danceStyleId: style.id,
        cards: { create: [{ cardId: general.id }, { cardId: trial.id }] },
        periods: {
          create: starts.map((startTime) => ({ startTime, endTime: new Date(startTime.getTime() + HOUR) })),
        },
      },
      select: { id: true, name: true },
    });
  });

  return lesson;
});
