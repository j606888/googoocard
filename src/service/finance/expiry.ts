import prisma from "@/lib/prisma";
import { cardUnitValue } from "@/domains/finance/income";
import { refreshNeedsRenewalTag } from "@/service/studentTag";

// 課卡到期（spec §5.2–5.3）。沒有排程（沒有 vercel.ts）：讀取時懶惰到期——
// 點名、自助簽到、LIFF 今天、學生詳情、財務保管讀取的開頭呼叫 expireDueCards。

export type ExpiryTarget = { type: "fund"; locationId: number } | { type: "user"; userId: number };

export type ExpiryEvent = {
  studentCardId: number;
  /** 過期那天 = 卡的 expiredAt */
  date: Date;
  /** 剩餘價值（退費的卡扣掉退款）；> 0 才會出現 */
  value: number;
  /** 錢在誰手上：paidByUserId ?? legacyCustodianUserId */
  holderUserId: number | null;
  soldLocationId: number | null;
  to: ExpiryTarget;
};

/**
 * 財務開啟的教室：把 expiresAt <= now 還沒關、還有剩格的卡關掉（expiredAt = expiresAt、
 * closedReason = EXPIRED），刷新 Needs Renewal tag。用完（0 格）的卡不算過期：沒有剩餘價值，
 * 關掉它反而會讓「需續約」消失。冪等；回傳這次關掉幾張。
 */
export async function expireDueCards(classroomId: number, now = new Date()): Promise<number> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { financeEnabledAt: true },
  });
  if (!classroom?.financeEnabledAt) return 0;

  const due = await prisma.studentCard.findMany({
    where: { student: { classroomId }, expiredAt: null, expiresAt: { lte: now }, remainingSessions: { gt: 0 } },
    select: { id: true, studentId: true, expiresAt: true },
  });
  if (due.length === 0) return 0;

  let closed = 0;
  const studentIds = new Set<number>();
  for (const card of due) {
    // 條件式更新：併發時同一張卡只會被關一次。
    const { count } = await prisma.studentCard.updateMany({
      where: { id: card.id, expiredAt: null },
      data: { expiredAt: card.expiresAt, closedReason: "EXPIRED" },
    });
    if (count === 1) {
      closed++;
      studentIds.add(card.studentId);
    }
  }
  // 依序跑：並行時 ensureNeedsRenewalTag 可能搶著建 tag。
  for (const studentId of studentIds) {
    await refreshNeedsRenewalTag(studentId, classroomId);
  }
  return closed;
}

/**
 * 已付款、因過期／作廢／退費關閉的卡的過期收入。轉換、轉讓關閉的卡
 * closedReason 是 null（錢跟著新卡走），不算。上線日之前關的卡不進財務。
 */
export async function expiryEvents(classroomId: number): Promise<ExpiryEvent[]> {
  return (await loadExpiries(classroomId)).events;
}

/**
 * expiryEvents ＋ 找不到歸屬的卡（沒有賣卡分部、也沒有舊保管人）：那份過期收入不進任何人的表，
 * 由帳本健康檢查提醒。
 */
export async function loadExpiries(classroomId: number): Promise<{ events: ExpiryEvent[]; unassigned: number[] }> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { financeEnabledAt: true, legacyCustodianUserId: true },
  });
  if (!classroom?.financeEnabledAt) return { events: [], unassigned: [] };
  const legacyId = classroom.legacyCustodianUserId;

  const cards = await prisma.studentCard.findMany({
    where: {
      student: { classroomId },
      isPaid: true,
      closedReason: { in: ["EXPIRED", "VOIDED", "REFUNDED"] },
      convertedToId: null,
      transferredToId: null,
      expiredAt: { gte: classroom.financeEnabledAt },
    },
    select: {
      id: true,
      expiredAt: true,
      closedReason: true,
      finalPrice: true,
      totalSessions: true,
      remainingSessions: true,
      paidByUserId: true,
      soldLocationId: true,
      refund: { select: { amount: true } },
    },
    orderBy: [{ expiredAt: "asc" }, { id: "asc" }],
  });
  if (cards.length === 0) return { events: [], unassigned: [] };

  const locations = await prisma.location.findMany({
    where: { classroomId },
    select: { id: true, keeperUserId: true, expiryTo: true, expiryUserId: true, archivedAt: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const byId = new Map(locations.map((l) => [l.id, l]));
  const legacyBranch =
    legacyId === null
      ? undefined
      : locations.find((l) => !l.archivedAt && l.keeperUserId === legacyId);

  const targetOf = (loc: (typeof locations)[number]): ExpiryTarget =>
    loc.expiryTo === "USER" && loc.expiryUserId !== null
      ? { type: "user", userId: loc.expiryUserId }
      : { type: "fund", locationId: loc.id };

  const events: ExpiryEvent[] = [];
  const unassigned: number[] = [];
  for (const card of cards) {
    let value = cardUnitValue(card) * card.remainingSessions;
    if (card.closedReason === "REFUNDED") value -= card.refund?.amount ?? 0;
    if (value <= 0) continue;

    const loc = (card.soldLocationId !== null && byId.get(card.soldLocationId)) || legacyBranch;
    let to: ExpiryTarget;
    if (loc) to = targetOf(loc);
    else if (legacyId !== null) to = { type: "user", userId: legacyId };
    else {
      // 找不到歸屬（開帳一定會設 legacy custodian，理論上不會發生）
      unassigned.push(card.id);
      continue;
    }

    events.push({
      studentCardId: card.id,
      date: card.expiredAt!,
      value,
      holderUserId: card.paidByUserId ?? legacyId,
      soldLocationId: card.soldLocationId,
      to,
    });
  }
  return { events, unassigned };
}
