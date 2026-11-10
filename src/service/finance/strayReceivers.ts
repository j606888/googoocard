import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { assertCanSettle, assertFinanceEnabled } from "./access";
import { assertCustodian } from "./config";
import { soldLocationFor } from "./receiver";
import { financeStart } from "./start";
import { cardNeedsHolderAccount, computeOpening } from "@/domains/ledger/opening";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { loadLedgerInputs } from "@/service/ledger/load";

/**
 * 開帳：轉換日之後收的錢、收款人卻不是保管人（例：開帳前小幫手代收），以及轉換日前的卡
 * 收款人不是保管人、轉換日還有預收的（那份錢算在他手上）——就是期初現金／過帳會說「沒有資金帳戶」的那些。
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

/** GET 的 ?conversionDate=YYYY-MM-DD（格式不對就當沒帶）。 */
export function conversionDateParam(request: Request): string | undefined {
  const v = new URL(request.url).searchParams.get("conversionDate");
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/**
 * 收款人整理看的轉換日：帶了就用（精靈裡期初現金草稿的日期）；沒帶 → 已開帳的轉換日，
 * 再不然開財務那天（跟期初現金的建議日一樣）。
 */
async function strayDate(classroomId: number, financeEnabledAt: Date, conversionDate?: string): Promise<string> {
  if (conversionDate) return conversionDate;
  return (await financeStart(classroomId))?.dateKey ?? toTaipeiDateKey(financeEnabledAt);
}

/**
 * 要改記的：收款人不是保管人、而且帳本會用到收款人資金帳戶的（跟期初現金／過帳同一條規則
 * cardNeedsHolderAccount——轉換日後收的錢，和轉換日還有預收的舊卡），單堂則是轉換日（含）之後收的。
 */
async function strayWhere(classroomId: number, conversionDate?: string) {
  const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
  const date = await strayDate(classroomId, financeEnabledAt, conversionDate);
  const custodians = await prisma.membership.findMany({
    where: { classroomId, isCustodian: true },
    select: { userId: true },
  });
  const custodianIds = new Set(custodians.map((m) => m.userId));
  const paidByUserId = { not: null, notIn: [...custodianIds] };
  const inputs = await loadLedgerInputs(classroomId, { conversionDate: date });
  const cardIds = (inputs?.cards ?? [])
    .filter((c) => c.paidByUserId !== null && !custodianIds.has(c.paidByUserId) && cardNeedsHolderAccount(c, date))
    .map((c) => c.id);
  const since = parseTaipeiDateRange(date).start;
  return {
    card: { student: { classroomId }, isPaid: true, paidByUserId, id: { in: cardIds } },
    dropIn: {
      attendanceRecord: { lessonPeriod: { lesson: { classroomId } } },
      isPaid: true,
      paidByUserId,
      OR: [{ createdAt: { gte: since } }, { paidAt: { gte: since } }],
    },
  };
}

export async function listStrayReceivers(classroomId: number, conversionDate?: string): Promise<StrayReceiverItem[]> {
  const where = await strayWhere(classroomId, conversionDate);
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

/**
 * 開帳的舊卡（期初現金第 7 步）：轉換日前就付清、轉換日那天還有剩餘價值、錢算在某位保管人手上的卡
 * → cardId 對應現在的經手人（paidByUserId，或舊卡的預設保管人）。
 * 跟期初試算用同一套規則（computeOpening），所以畫面上列在誰名下，這裡就認誰。
 * 已經開過帳：轉換日最多到已開帳的那一天，不會動到開帳後買的卡。
 */
async function openingCustodianCards(classroomId: number, conversionDate: string, custodianIds: Set<number>) {
  const opened = await financeStart(classroomId);
  const date = opened && opened.dateKey < conversionDate ? opened.dateKey : conversionDate;
  const inputs = await loadLedgerInputs(classroomId, { conversionDate: date });
  const out = new Map<number, number>();
  if (!inputs) return out;
  const { cards } = computeOpening({
    conversionDate: date,
    method: "CONVENTION",
    cards: inputs.cards,
    ctx: inputs.ctx,
    cash: [],
    prepaidVenues: [],
    payables: [],
    moneyAccountLocation: () => null,
  });
  for (const c of cards) {
    if (c.holderUserId !== null && c.deferred !== 0 && custodianIds.has(c.holderUserId)) out.set(c.cardId, c.holderUserId);
  }
  return out;
}

/** 一組改記：這幾筆改到 toUserId（必須是保管人）。 */
export type StrayMove = { toUserId: number; cardIds: number[]; dropInIds: number[] };

/**
 * 改記到保管人（可以一次送好幾組）。卡沒有賣卡分部時補上新保管人負責的分部。
 * 原本的收款人留在 collectedByUserId——只在還沒記過時寫（保留第一位經手的人），之後能復原。
 *
 * 帶 `conversionDate`（期初現金那一步）：開帳的舊卡錢在保管人 A 手上、其實已經交給保管人 B 了，
 * 也能改記（見 openingCustodianCards）；這些卡不補賣卡分部（復原才能完全還原），改回第一位經手的人
 * 就清掉 collectedByUserId（等於復原）。鎖帳後不能改（409）。
 */
export async function reassignStrayReceivers(args: {
  classroomId: number;
  userId: number;
  moves: StrayMove[];
  conversionDate?: string;
}) {
  const { classroomId, userId, moves, conversionDate } = args;
  await assertCanSettle(userId, classroomId);
  for (const m of moves) await assertCustodian(m.toUserId, classroomId);
  const where = await strayWhere(classroomId, conversionDate);
  const soldLocations = await Promise.all(moves.map((m) => soldLocationFor(classroomId, m.toUserId)));
  let openingCards = new Map<number, number>();
  if (conversionDate) {
    const c = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { financeLockDate: true } });
    if (c?.financeLockDate) throw new ApiError(409, "PERIOD_LOCKED", "The ledger is locked; opening cards can no longer be reassigned");
    const custodians = await prisma.membership.findMany({ where: { classroomId, isCustodian: true }, select: { userId: true } });
    openingCards = await openingCustodianCards(classroomId, conversionDate, new Set(custodians.map((m) => m.userId)));
  }

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
      // 開帳的舊卡：保管人 → 另一位保管人
      const strayIds = new Set(cards.map((c) => c.id));
      const oldIds = m.cardIds.filter((id) => !strayIds.has(id) && openingCards.has(id) && openingCards.get(id) !== m.toUserId);
      const oldCards = oldIds.length
        ? await tx.studentCard.findMany({
            where: { id: { in: oldIds }, student: { classroomId }, isPaid: true },
            select: { id: true, paidByUserId: true, collectedByUserId: true },
          })
        : [];
      for (const c of oldCards) {
        const first = c.collectedByUserId ?? c.paidByUserId ?? openingCards.get(c.id)!;
        await tx.studentCard.update({
          where: { id: c.id },
          data: { paidByUserId: m.toUserId, collectedByUserId: first === m.toUserId ? null : first },
        });
      }
      cardCount += oldCards.length;
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
