import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { notifyClassroom } from "@/service/push";

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

/**
 * 找出「害這位學生需要續卡」的那張卡：未過期、非單堂卡、同卡種中最新的一張，
 * 且剩餘堂數為 0。沒有就回傳 null。
 *
 * 這是續卡判定的**唯一**出處——「Needs Renewal」tag 與續卡提醒推播
 * （src/service/renewalReminder.ts）都建立在它之上。要改規則就改這裡，
 * 不要在別處另寫一套。
 */
export async function findExhaustedRenewableCard(studentId: number) {
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
  return [...latestCardByType.values()].find((sc) => sc.remainingSessions === 0) ?? null;
}

export async function refreshNeedsRenewalTag(studentId: number, classroomId: number) {
  const exhaustedCard = await findExhaustedRenewableCard(studentId);

  const tag = await ensureNeedsRenewalTag(classroomId);

  if (exhaustedCard) {
    // ON CONFLICT DO NOTHING：count 是 1 才代表「這次才加上」。用它當推播的唯一觸發條件——
    // 這個函式在點名、購卡、轉卡、過期時都會被呼叫，tag 已經在身上就不能再推一次。
    // 併發時也只有搶到 insert 的那一個會拿到 1。
    const { count } = await prisma.studentTag.createMany({
      data: [{ studentId, tagId: tag.id }],
      skipDuplicates: true,
    });
    if (count === 1) {
      await notifyNeedsRenewal(studentId, classroomId, exhaustedCard.card.name);
    }
  } else {
    await prisma.studentTag.deleteMany({
      where: { studentId, tagId: tag.id },
    });
  }
}

async function notifyNeedsRenewal(studentId: number, classroomId: number, cardName: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { name: true, archivedAt: true },
  });
  // 封存的學生不在「待處理」裡（src/service/todos.ts），也就不推。
  if (!student || student.archivedAt) return;

  await notifyClassroom(classroomId, {
    type: "NEEDS_RENEWAL",
    title: "需續約",
    body: `${student.name} 的「${cardName}」用完了`,
    path: `/students/${studentId}`,
  });
}

export async function refreshNeedsRenewalTags(studentIds: number[], classroomId: number) {
  await Promise.all(studentIds.map((id) => refreshNeedsRenewalTag(id, classroomId)));
}
