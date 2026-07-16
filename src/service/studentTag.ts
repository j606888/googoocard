import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const NEEDS_RENEWAL_TAG = "Needs Renewal";

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// The "Needs Renewal" tag is a single classroom-scoped row that EVERY student's
// refresh contends on. prisma.upsert is select-then-insert (not atomic), so
// concurrent refreshes (e.g. two students self-checking-in at once) can both try
// to create it and one hits a unique violation. Treat that as "already created".
async function ensureNeedsRenewalTag(classroomId: number) {
  const where = {
    name_classroomId: { name: NEEDS_RENEWAL_TAG, classroomId },
  } as const;
  try {
    return await prisma.tag.upsert({
      where,
      create: { name: NEEDS_RENEWAL_TAG, classroomId },
      update: {},
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return prisma.tag.findUniqueOrThrow({ where });
    }
    throw e;
  }
}

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

  const tag = await ensureNeedsRenewalTag(classroomId);

  if (needsRenewal) {
    try {
      await prisma.studentTag.upsert({
        where: { studentId_tagId: { studentId, tagId: tag.id } },
        create: { studentId, tagId: tag.id },
        update: {},
      });
    } catch (e) {
      // Concurrent refresh of the same student already attached it — fine.
      if (!isUniqueViolation(e)) throw e;
    }
  } else {
    await prisma.studentTag.deleteMany({
      where: { studentId, tagId: tag.id },
    });
  }
}

export async function refreshNeedsRenewalTags(studentIds: number[], classroomId: number) {
  await Promise.all(studentIds.map((id) => refreshNeedsRenewalTag(id, classroomId)));
}
