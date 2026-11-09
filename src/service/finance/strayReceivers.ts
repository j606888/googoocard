import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { assertCanSettle, assertFinanceEnabled } from "./access";
import { assertCustodian } from "./config";
import { soldLocationFor } from "./receiver";
import { financeSince } from "./start";

/**
 * 開帳：上線日之後收的錢、收款人卻不是保管人（例：開帳前小幫手代收），以及上線前的卡
 * 收款人不是保管人、還有剩格的（那份預收還在他手上）。
 * 之後的收款只能選保管人，所以這是一次性的整理——改記到一位保管人名下，
 * 帳本才知道錢在哪個資金帳戶（收款人沒有資金帳戶的卡記不進帳）。
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
  /** 之前改記過：第一位實際收錢的人 */
  collectedByName: string | null;
};

async function strayWhere(classroomId: number) {
  const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
  const custodians = await prisma.membership.findMany({
    where: { classroomId, isCustodian: true },
    select: { userId: true },
  });
  const paidByUserId = { not: null, notIn: custodians.map((m) => m.userId) };
  const since = await financeSince(classroomId, financeEnabledAt);
  const sinceLaunch = [{ createdAt: { gte: since } }, { paidAt: { gte: since } }];
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
        collectedByUserId: true,
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
        collectedByUserId: true,
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
  const userIds = [
    ...new Set([...cards, ...dropIns].flatMap((r) => [r.paidByUserId!, ...(r.collectedByUserId ? [r.collectedByUserId] : [])])),
  ];
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
      collectedByName: c.collectedByUserId ? (nameOf.get(c.collectedByUserId) ?? "") : null,
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
      collectedByName: d.collectedByUserId ? (nameOf.get(d.collectedByUserId) ?? "") : null,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** 一組改記：這幾筆改到 toUserId（必須是保管人）。 */
export type StrayMove = { toUserId: number; cardIds: number[]; dropInIds: number[] };

/**
 * 改記到保管人（可以一次送好幾組）。卡沒有賣卡分部時補上新保管人負責的分部。
 * 原本的收款人留在 collectedByUserId——只在還沒記過時寫（保留第一位經手的人），之後能復原。
 */
export async function reassignStrayReceivers(args: { classroomId: number; userId: number; moves: StrayMove[] }) {
  const { classroomId, userId, moves } = args;
  await assertCanSettle(userId, classroomId);
  for (const m of moves) await assertCustodian(m.toUserId, classroomId);
  const where = await strayWhere(classroomId);
  const soldLocations = await Promise.all(moves.map((m) => soldLocationFor(classroomId, m.toUserId)));

  return prisma.$transaction(async (tx) => {
    let cardCount = 0;
    let dropInCount = 0;
    for (const [idx, m] of moves.entries()) {
      const cards = await tx.studentCard.findMany({
        where: { ...where.card, id: { in: m.cardIds } },
        select: { id: true, paidByUserId: true, collectedByUserId: true, soldLocationId: true },
      });
      for (const c of cards) {
        await tx.studentCard.update({
          where: { id: c.id },
          data: {
            paidByUserId: m.toUserId,
            collectedByUserId: c.collectedByUserId ?? c.paidByUserId,
            ...(c.soldLocationId === null && soldLocations[idx] !== null ? { soldLocationId: soldLocations[idx] } : {}),
          },
        });
      }
      const dropIns = await tx.dropInCharge.findMany({
        where: { ...where.dropIn, id: { in: m.dropInIds } },
        select: { id: true, paidByUserId: true, collectedByUserId: true },
      });
      for (const d of dropIns) {
        await tx.dropInCharge.update({
          where: { id: d.id },
          data: { paidByUserId: m.toUserId, collectedByUserId: d.collectedByUserId ?? d.paidByUserId },
        });
      }
      cardCount += cards.length;
      dropInCount += dropIns.length;
    }
    return { cards: cardCount, dropIns: dropInCount };
  });
}

/** 開帳整理改記過的（collectedByUserId 有值、而且跟現在的收款人不同）：原收款人 → 現在的保管人。 */
export type ReassignedItem = {
  kind: "card" | "dropIn";
  id: number;
  studentName: string;
  label: string;
  amount: number;
  date: Date;
  collectedByUserId: number;
  collectedByName: string;
  holderUserId: number;
  holderName: string;
};

function reassignedWhere(classroomId: number) {
  return {
    card: { student: { classroomId }, collectedByUserId: { not: null }, paidByUserId: { not: null } },
    dropIn: {
      attendanceRecord: { lessonPeriod: { lesson: { classroomId } } },
      collectedByUserId: { not: null },
      paidByUserId: { not: null },
    },
  };
}

export async function listReassigned(classroomId: number): Promise<ReassignedItem[]> {
  const where = reassignedWhere(classroomId);
  const [cards, dropIns] = await Promise.all([
    prisma.studentCard.findMany({
      where: where.card,
      select: {
        id: true,
        finalPrice: true,
        paidAt: true,
        createdAt: true,
        paidByUserId: true,
        collectedByUserId: true,
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
        collectedByUserId: true,
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
  const rows = [...cards, ...dropIns].filter((r) => r.paidByUserId !== r.collectedByUserId);
  const userIds = [...new Set(rows.flatMap((r) => [r.paidByUserId!, r.collectedByUserId!]))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const people = (r: { paidByUserId: number | null; collectedByUserId: number | null }) => ({
    collectedByUserId: r.collectedByUserId!,
    collectedByName: nameOf.get(r.collectedByUserId!) ?? "",
    holderUserId: r.paidByUserId!,
    holderName: nameOf.get(r.paidByUserId!) ?? "",
  });
  return [
    ...cards
      .filter((c) => c.paidByUserId !== c.collectedByUserId)
      .map((c) => ({
        kind: "card" as const,
        id: c.id,
        studentName: c.student.name,
        label: c.card.name,
        amount: c.finalPrice,
        date: c.paidAt ?? c.createdAt,
        ...people(c),
      })),
    ...dropIns
      .filter((d) => d.paidByUserId !== d.collectedByUserId)
      .map((d) => ({
        kind: "dropIn" as const,
        id: d.id,
        studentName: d.attendanceRecord.student.name,
        label: d.attendanceRecord.lessonPeriod.lesson.name,
        amount: d.amount,
        date: d.paidAt ?? d.createdAt,
        ...people(d),
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * 復原：改記過的幾筆還給原收款人（paidByUserId = collectedByUserId、collectedByUserId 清空）。
 * 鎖帳以後不能復原（409 PERIOD_LOCKED）。補上的賣卡分部不動。
 */
export async function restoreStrayReceivers(args: {
  classroomId: number;
  userId: number;
  cardIds: number[];
  dropInIds: number[];
}) {
  const { classroomId, userId, cardIds, dropInIds } = args;
  await assertCanSettle(userId, classroomId);
  const c = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { financeLockDate: true } });
  if (c?.financeLockDate) throw new ApiError(409, "PERIOD_LOCKED", "The ledger is locked; reassignments can no longer be undone");
  const where = reassignedWhere(classroomId);

  return prisma.$transaction(async (tx) => {
    const cards = await tx.studentCard.findMany({
      where: { ...where.card, id: { in: cardIds } },
      select: { id: true, collectedByUserId: true },
    });
    for (const r of cards) {
      await tx.studentCard.update({ where: { id: r.id }, data: { paidByUserId: r.collectedByUserId, collectedByUserId: null } });
    }
    const dropIns = await tx.dropInCharge.findMany({
      where: { ...where.dropIn, id: { in: dropInIds } },
      select: { id: true, collectedByUserId: true },
    });
    for (const r of dropIns) {
      await tx.dropInCharge.update({ where: { id: r.id }, data: { paidByUserId: r.collectedByUserId, collectedByUserId: null } });
    }
    return { cards: cards.length, dropIns: dropIns.length };
  });
}
