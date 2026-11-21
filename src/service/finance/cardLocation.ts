import type { Prisma } from "@prisma/client";

/**
 * 新卡的「錢的分部」與「卡的分部」預設值（docs/finance-lite.md §2）：
 * 1. 在課堂上買的 → 那堂課的分部
 * 2. 收款人（或建卡的人）是某分部負責人 → 那個分部
 * 3. 他的名冊（Teacher.locations）第一個分部
 * 4. 教室只有一個分部 → 它
 * 都沒有 → null（結清時提醒「卡沒有分部」，可結算的人可以補）。
 */
export async function defaultCardLocationIdInTx(
  tx: Prisma.TransactionClient,
  classroomId: number,
  { lessonLocationId = null, userId = null }: { lessonLocationId?: number | null; userId?: number | null }
): Promise<number | null> {
  if (lessonLocationId) return lessonLocationId;

  if (userId) {
    const kept = await tx.location.findFirst({
      where: { classroomId, keeperUserId: userId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (kept) return kept.id;

    const person = await tx.teacher.findFirst({
      where: { classroomId, userId },
      select: {
        locations: {
          where: { archivedAt: null },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true },
          take: 1,
        },
      },
    });
    if (person?.locations[0]) return person.locations[0].id;
  }

  const active = await tx.location.findMany({
    where: { classroomId, archivedAt: null },
    select: { id: true },
    take: 2,
  });
  return active.length === 1 ? active[0].id : null;
}

/** 轉換、轉讓出來的新卡沿用舊卡的分部：錢還是同一筆錢。 */
export async function inheritCardLocationsInTx(tx: Prisma.TransactionClient, sourceCardId: number) {
  const source = await tx.studentCard.findUniqueOrThrow({
    where: { id: sourceCardId },
    select: { moneyLocationId: true, homeLocationId: true },
  });
  return { moneyLocationId: source.moneyLocationId, homeLocationId: source.homeLocationId };
}
