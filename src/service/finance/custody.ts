import prisma from "@/lib/prisma";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { cardUnitValue } from "@/domains/finance/income";
import { computeCustody, emptyBuckets, resolvePayee } from "@/domains/finance/ledger";
import type { Buckets, Keepers, LedgerInput } from "@/domains/finance/ledger";
import { assertFinanceEnabled } from "./access";
import { expireDueCards, expiryEvents } from "./expiry";
import { loadPeriodFinance } from "./periods";

export type CustodyWarning =
  // 找不到該付的人（老師沒設付款人、分部沒設負責人…）：錢先放在 holder 的「未分配」
  | { code: "UNRESOLVED_KEEPER"; periodId?: number; locationId?: number }
  // 已付款的錢找不到保管人（沒有收款人、也沒設開帳保管人）：不進任何人的表
  | { code: "UNKNOWN_HOLDER"; periodId?: number; studentCardId?: number };

export type CustodyUser = { userId: number; name: string; buckets: Buckets };

/** 組 computeCustody 的輸入與負責人表。months 先用事件本身的台北月份（Task 13 改成 assignMonth）。 */
export async function loadLedger(classroomId: number): Promise<{
  input: LedgerInput;
  keepers: Keepers;
  warnings: CustodyWarning[];
}> {
  const { legacyCustodianUserId } = await assertFinanceEnabled(classroomId);
  await expireDueCards(classroomId);
  const warnings: CustodyWarning[] = [];

  const [periods, expiries, cards, expenses, packs, transfers, refunds, locations, venues, teachers, financeMembers] =
    await Promise.all([
      loadPeriodFinance(classroomId, {}),
      expiryEvents(classroomId),
      prisma.studentCard.findMany({
        where: { student: { classroomId }, isPaid: true, expiredAt: null, remainingSessions: { gt: 0 } },
        select: { id: true, finalPrice: true, totalSessions: true, remainingSessions: true, paidByUserId: true },
      }),
      prisma.financeExpense.findMany({
        where: { classroomId, voidedAt: null },
        select: { amount: true, locationId: true, paidByUserId: true, date: true },
      }),
      prisma.venuePack.findMany({
        where: { classroomId },
        select: { id: true, price: true, paidByUserId: true, voidedAt: true },
      }),
      prisma.financeTransfer.findMany({
        where: { classroomId, voidedAt: null },
        select: {
          amount: true,
          fromUserId: true,
          toKind: true,
          toUserId: true,
          toTeacherId: true,
          toVenueId: true,
          date: true,
        },
      }),
      prisma.financeRefund.findMany({
        where: { studentCard: { student: { classroomId } } },
        select: { amount: true, paidByUserId: true, date: true, studentCard: { select: { paidByUserId: true } } },
      }),
      prisma.location.findMany({
        where: { classroomId },
        select: { id: true, keeperUserId: true, fundOpening: true },
      }),
      prisma.venue.findMany({ where: { classroomId }, select: { id: true, landlordUserId: true } }),
      prisma.teacher.findMany({ where: { classroomId }, select: { id: true, userId: true, payerUserId: true } }),
      prisma.membership.findMany({ where: { classroomId, isFinance: true }, select: { userId: true } }),
    ]);

  const financeIds = new Set(financeMembers.map((m) => m.userId));
  const fundKeeper: Record<number, number> = {};
  for (const l of locations) if (l.keeperUserId !== null) fundKeeper[l.id] = l.keeperUserId;
  const periodBranch = new Map(periods.map((p) => [p.periodId, p.locationId]));

  const keepers: Keepers = {
    teacherPayer: Object.fromEntries(
      teachers.flatMap((t) => {
        const payer = t.payerUserId ?? (t.userId !== null && financeIds.has(t.userId) ? t.userId : null);
        return payer === null ? [] : [[t.id, payer]];
      }),
    ),
    teacherUser: Object.fromEntries(teachers.map((t) => [t.id, t.userId])),
    fundKeeper,
    venueLandlord: Object.fromEntries(venues.map((v) => [v.id, v.landlordUserId])),
    packPayer: Object.fromEntries(packs.map((p) => [p.id, p.paidByUserId])),
    branchKeeperOfPeriod: (periodId) => {
      const locationId = periodBranch.get(periodId);
      return locationId == null ? null : (fundKeeper[locationId] ?? null);
    },
  };

  const prepaid: LedgerInput["prepaid"] = [];
  for (const c of cards) {
    const value = cardUnitValue(c) * c.remainingSessions;
    if (value === 0) continue;
    const holder = c.paidByUserId ?? legacyCustodianUserId;
    if (holder === null) warnings.push({ code: "UNKNOWN_HOLDER", studentCardId: c.id });
    else prepaid.push({ holderUserId: holder, value });
  }

  const input: LedgerInput = {
    periods: periods.map((p) => ({
      periodId: p.periodId,
      month: p.month,
      income: p.income.realized,
      allocations: p.allocations,
    })),
    prepaid,
    expiries: expiries.map((e) => ({ ...e, month: toTaipeiMonthKey(e.date) })),
    expenses: expenses.map((e) => ({
      amount: e.amount,
      locationId: e.locationId,
      paidByUserId: e.paidByUserId,
      month: toTaipeiMonthKey(e.date),
    })),
    packs: packs
      .filter((p) => p.voidedAt === null)
      .map((p) => ({ packId: p.id, price: p.price, paidByUserId: p.paidByUserId })),
    transfers: transfers.map((t) => ({
      amount: t.amount,
      fromUserId: t.fromUserId,
      toKind: t.toKind as LedgerInput["transfers"][number]["toKind"],
      ...(t.toUserId !== null ? { toUserId: t.toUserId } : {}),
      ...(t.toTeacherId !== null ? { toTeacherId: t.toTeacherId } : {}),
      ...(t.toVenueId !== null ? { toVenueId: t.toVenueId } : {}),
      month: toTaipeiMonthKey(t.date),
    })),
    refunds: refunds.map((r) => ({
      amount: r.amount,
      paidByUserId: r.paidByUserId,
      holderUserId: r.studentCard.paidByUserId ?? legacyCustodianUserId,
      month: toTaipeiMonthKey(r.date),
    })),
    fundOpening: Object.fromEntries(locations.map((l) => [l.id, l.fundOpening])),
    roundings: [],
  };

  return { input, keepers, warnings };
}

/** computeCustody 會把找不到負責人的錢放進未分配；這裡列出是哪些，給畫面提醒。 */
function ledgerWarnings(input: LedgerInput, keepers: Keepers, through?: string): CustodyWarning[] {
  const inRange = (month: string) => !through || month <= through;
  const out: CustodyWarning[] = [];
  for (const p of input.periods) {
    if (!inRange(p.month)) continue;
    if (p.income.some((s) => s.paid && s.amount !== 0 && s.holderUserId === null)) {
      out.push({ code: "UNKNOWN_HOLDER", periodId: p.periodId });
    }
    if (p.allocations?.some((a) => a.amount !== 0 && !resolvePayee(a.payee, p.periodId, keepers))) {
      out.push({ code: "UNRESOLVED_KEEPER", periodId: p.periodId });
    }
  }
  const fundLocations = new Set<number>([
    ...input.expenses.filter((e) => inRange(e.month)).map((e) => e.locationId),
    ...input.expiries
      .filter((e) => inRange(e.month) && e.to.type === "fund")
      .map((e) => (e.to as { locationId: number }).locationId),
    ...Object.entries(input.fundOpening)
      .filter(([, amount]) => amount !== 0)
      .map(([id]) => Number(id)),
  ]);
  for (const locationId of fundLocations) {
    if (keepers.fundKeeper[locationId] === undefined) out.push({ code: "UNRESOLVED_KEEPER", locationId });
  }
  return out;
}

/** 每個保管人的保管中（spec §7.1）。`through` = 只算到那個月（YYYY-MM）。 */
export async function getCustody(
  classroomId: number,
  through?: string,
): Promise<{ users: CustodyUser[]; warnings: CustodyWarning[] }> {
  const { input, keepers, warnings } = await loadLedger(classroomId);
  const custody = computeCustody(input, keepers, through ? { through } : undefined);

  const members = await prisma.membership.findMany({
    where: { classroomId, isFinance: true },
    select: { userId: true },
  });
  const userIds = [...new Set([...members.map((m) => m.userId), ...Object.keys(custody).map(Number)])];
  const names = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(names.map((u) => [u.id, u.name]));

  return {
    users: userIds
      .sort((a, b) => a - b)
      .map((userId) => ({ userId, name: nameOf.get(userId) ?? "", buckets: custody[userId] ?? emptyBuckets() })),
    warnings: [...warnings, ...ledgerWarnings(input, keepers, through)],
  };
}
