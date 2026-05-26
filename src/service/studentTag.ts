import prisma from "@/lib/prisma";

const NEEDS_RENEWAL_TAG = "Needs Renewal";

async function computeNeedsRenewal(studentId: number): Promise<boolean> {
  const studentCards = await prisma.studentCard.findMany({
    where: { studentId, expiredAt: null },
    include: { card: true },
    orderBy: { createdAt: "desc" },
  });

  const renewableCards = studentCards.filter((sc) => sc.totalSessions > 1);
  const latestCardByType = new Map<number, (typeof renewableCards)[number]>();
  for (const sc of renewableCards) {
    if (!latestCardByType.has(sc.cardId)) {
      latestCardByType.set(sc.cardId, sc);
    }
  }
  return [...latestCardByType.values()].some((sc) => sc.remainingSessions === 0);
}

export async function refreshNeedsRenewalTag(studentId: number, classroomId: number) {
  const needsRenewal = await computeNeedsRenewal(studentId);

  const tag = await prisma.tag.upsert({
    where: { name_classroomId: { name: NEEDS_RENEWAL_TAG, classroomId } },
    create: { name: NEEDS_RENEWAL_TAG, classroomId },
    update: {},
  });

  if (needsRenewal) {
    await prisma.studentTag.upsert({
      where: { studentId_tagId: { studentId, tagId: tag.id } },
      create: { studentId, tagId: tag.id },
      update: {},
    });
  } else {
    await prisma.studentTag.deleteMany({
      where: { studentId, tagId: tag.id },
    });
  }
}

export async function refreshNeedsRenewalTags(studentIds: number[], classroomId: number) {
  await Promise.all(studentIds.map((id) => refreshNeedsRenewalTag(id, classroomId)));
}
