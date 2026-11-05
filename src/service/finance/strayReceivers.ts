import prisma from "@/lib/prisma";
import { assertCanSettle, assertFinanceEnabled } from "./access";
import { assertCustodian } from "./config";
import { soldLocationFor } from "./receiver";

/**
 * 開帳：上線日之後收的錢、收款人卻不是保管人（例：開帳前小幫手代收），以及上線前的卡
 * 收款人不是保管人、還有剩格的（那份預收還在他手上）。
 * 之後的收款只能選保管人，所以這是一次性的整理——改記到一位保管人名下，
 * 保管中與結算單才不會出現非保管人。
 */
export type StrayReceiverItem = {
  kind: "card" | "dropIn";
  id: number;
  studentName: string;
  /** 卡名或課名 */
  label: string;
  amount: number;
  date: Date;
  receiverUserId: number;
  receiverName: string;
};

async function strayWhere(classroomId: number) {
  const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
  const custodians = await prisma.membership.findMany({
    where: { classroomId, isCustodian: true },
    select: { userId: true },
  });
  const paidByUserId = { not: null, notIn: custodians.map((m) => m.userId) };
  const sinceLaunch = [{ createdAt: { gte: financeEnabledAt } }, { paidAt: { gte: financeEnabledAt } }];
  return {
    card: {
      student: { classroomId },
      isPaid: true,
      paidByUserId,
      // 上線前的卡：還開著、還有剩格才要改
      OR: [...sinceLaunch, { expiredAt: null, remainingSessions: { gt: 0 } }],
    },
    dropIn: {
      attendanceRecord: { lessonPeriod: { lesson: { classroomId } } },
      isPaid: true,
      paidByUserId,
      OR: sinceLaunch,
    },
  };
}

export async function listStrayReceivers(classroomId: number): Promise<StrayReceiverItem[]> {
  const where = await strayWhere(classroomId);
  const [cards, dropIns] = await Promise.all([
    prisma.studentCard.findMany({
      where: where.card,
      select: {
        id: true,
        finalPrice: true,
        paidAt: true,
        createdAt: true,
        paidByUserId: true,
        student: { select: { name: true } },
        card: { select: { name: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.dropInCharge.findMany({
      where: where.dropIn,
      select: {
        id: true,
        amount: true,
        paidAt: true,
        createdAt: true,
        paidByUserId: true,
        attendanceRecord: {
          select: {
            student: { select: { name: true } },
            lessonPeriod: { select: { lesson: { select: { name: true } } } },
          },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);
  const userIds = [...new Set([...cards, ...dropIns].map((r) => r.paidByUserId!))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return [
    ...cards.map((c) => ({
      kind: "card" as const,
      id: c.id,
      studentName: c.student.name,
      label: c.card.name,
      amount: c.finalPrice,
      date: c.paidAt ?? c.createdAt,
      receiverUserId: c.paidByUserId!,
      receiverName: nameOf.get(c.paidByUserId!) ?? "",
    })),
    ...dropIns.map((d) => ({
      kind: "dropIn" as const,
      id: d.id,
      studentName: d.attendanceRecord.student.name,
      label: d.attendanceRecord.lessonPeriod.lesson.name,
      amount: d.amount,
      date: d.paidAt ?? d.createdAt,
      receiverUserId: d.paidByUserId!,
      receiverName: nameOf.get(d.paidByUserId!) ?? "",
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** 把選的幾筆改記到 toUserId（必須是保管人）。卡沒有賣卡分部時補上收款人負責的分部。 */
export async function reassignStrayReceivers(args: {
  classroomId: number;
  userId: number;
  toUserId: number;
  cardIds: number[];
  dropInIds: number[];
}) {
  const { classroomId, userId, toUserId, cardIds, dropInIds } = args;
  await assertCanSettle(userId, classroomId);
  await assertCustodian(toUserId, classroomId);
  const where = await strayWhere(classroomId);
  const soldLocationId = await soldLocationFor(classroomId, toUserId);

  return prisma.$transaction(async (tx) => {
    const cardWhere = { ...where.card, id: { in: cardIds } };
    if (soldLocationId !== null) {
      await tx.studentCard.updateMany({ where: { ...cardWhere, soldLocationId: null }, data: { soldLocationId } });
    }
    const cards = await tx.studentCard.updateMany({ where: cardWhere, data: { paidByUserId: toUserId } });
    const dropIns = await tx.dropInCharge.updateMany({
      where: { ...where.dropIn, id: { in: dropInIds } },
      data: { paidByUserId: toUserId },
    });
    return { cards: cards.count, dropIns: dropIns.count };
  });
}
