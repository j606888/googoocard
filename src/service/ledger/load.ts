// 一次載入整間教室的過帳輸入（docs/finance-v2/03 §3）。跟 feat/finance 的 loadLedger 一樣是整批載入，
// 所以漏掉某個寫入路徑的 dirty 標記也不會漏帳：每次 sync 都從營運資料重算全部來源的應有分錄。
import prisma from "@/lib/prisma";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { effectiveRule, resolvePackUnitPrices } from "@/service/finance/periods";
import { ensureLedgerSetup } from "./setup";
import { cardDeferredLocation, cardRemainingValue, cardUsageValues, usageValueKey, type ConvertedFrom } from "@/domains/ledger/post/card";
import type {
  CardInput,
  CashCountInput,
  ExpenseInput,
  MoneyTransferInput,
  OwnerTxnInput,
  PayoutInput,
  MoneyAccountInfo,
  PeriodInput,
  PostingContext,
  VenuePackInput,
} from "@/domains/ledger/post/types";

export type LedgerInputs = {
  classroomId: number;
  ctx: PostingContext;
  lockDate: string | null;
  cards: CardInput[];
  convertedFrom: Map<number, ConvertedFrom[]>;
  periods: PeriodInput[];
  expenses: ExpenseInput[];
  packs: VenuePackInput[];
  payouts: PayoutInput[];
  transfers: MoneyTransferInput[];
  ownerTxns: OwnerTxnInput[];
  cashCounts: CashCountInput[];
  /** systemKey → accountId；moneyAccountId → accountId */
  accountIdOfKey: Record<string, number>;
  accountIdOfMoney: Map<number, number>;
};

export function dateKeyOfDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 沒啟用財務 → null。 */
export async function loadLedgerInputs(
  classroomId: number,
  opts: { conversionDate?: string } = {},
): Promise<LedgerInputs | null> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { financeEnabledAt: true, financeConversionDate: true, financeLockDate: true, legacyCustodianUserId: true },
  });
  if (!classroom?.financeEnabledAt) return null;
  await ensureLedgerSetup(classroomId);

  const conversionDate = opts.conversionDate ?? (classroom.financeConversionDate
    ? dateKeyOfDbDate(classroom.financeConversionDate)
    : toTaipeiDateKey(classroom.financeEnabledAt));

  const [locations, moneyAccounts, accounts, rawCards, rawPeriods, rawExpenses, rawPacks, packPrices, rawPayouts, rawTransfers, rawOwner, rawCounts] = await Promise.all([
    prisma.location.findMany({
      where: { classroomId },
      select: { id: true, archivedAt: true, expiryTo: true, expiryUserId: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.moneyAccount.findMany({
      where: { classroomId },
      select: { id: true, holderUserId: true, locationId: true, accountId: true, isDefault: true, archivedAt: true },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    }),
    prisma.ledgerAccount.findMany({
      where: { classroomId },
      select: { id: true, name: true, systemKey: true, parentId: true, archivedAt: true },
    }),
    prisma.studentCard.findMany({
      where: { student: { classroomId } },
      select: {
        id: true,
        createdAt: true,
        finalPrice: true,
        totalSessions: true,
        remainingSessions: true,
        isPaid: true,
        paidAt: true,
        paidByUserId: true,
        origin: true,
        soldLocationId: true,
        expiredAt: true,
        closedReason: true,
        convertedToId: true,
        transferredToId: true,
        refund: { select: { amount: true, paidByUserId: true, date: true } },
        attendanceRecords: {
          select: { id: true, sessionsUsed: true, lessonPeriod: { select: { id: true, startTime: true, attendanceTakenAt: true } } },
        },
        absences: {
          select: { id: true, sessionsUsed: true, lessonPeriod: { select: { id: true, startTime: true, attendanceTakenAt: true } } },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.lessonPeriod.findMany({
      where: { lesson: { classroomId }, attendanceTakenAt: { not: null } },
      select: {
        id: true,
        startTime: true,
        splitOverride: { select: { rule: true } },
        lesson: { select: { locationId: true, splitRule: { select: { rule: true } } } },
        attendanceRecords: {
          select: {
            id: true,
            studentCardId: true,
            dropInCharge: { select: { id: true, amount: true, isPaid: true, paidAt: true, createdAt: true, paidByUserId: true } },
          },
          orderBy: { id: "asc" },
        },
        absences: { select: { id: true, studentCardId: true }, orderBy: { id: "asc" } },
      },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
    prisma.financeExpense.findMany({
      where: { classroomId },
      select: { id: true, date: true, amount: true, locationId: true, category: true, paidByUserId: true, moneyAccountId: true, isAdvance: true, voidedAt: true },
    }),
    prisma.venuePack.findMany({
      where: { classroomId },
      select: { id: true, venueId: true, purchasedAt: true, price: true, paidByUserId: true, voidedAt: true },
    }),
    resolvePackUnitPrices(classroomId),
    prisma.payout.findMany({ where: { classroomId, status: "PAID" } }),
    prisma.moneyTransfer.findMany({ where: { classroomId, status: "PAID" } }),
    prisma.ownerTransaction.findMany({ where: { classroomId } }),
    prisma.cashCount.findMany({ where: { classroomId } }),
  ]);

  const liveLocations = locations.filter((l) => !l.archivedAt);
  const locationIds = new Set(locations.map((l) => l.id));
  const expiryUser = new Map(locations.map((l) => [l.id, l.expiryTo === "USER" ? l.expiryUserId : null]));

  const maOfUser = new Map<number, MoneyAccountInfo>();
  for (const m of moneyAccounts) {
    if (!m.archivedAt && !maOfUser.has(m.holderUserId)) maOfUser.set(m.holderUserId, { id: m.id, locationId: m.locationId });
  }
  const maById = new Map(moneyAccounts.map((m) => [m.id, { id: m.id, locationId: m.locationId }]));
  const accountIdOfMoney = new Map(moneyAccounts.map((m) => [m.id, m.accountId]));

  const accountIdOfKey: Record<string, number> = {};
  for (const a of accounts) if (a.systemKey) accountIdOfKey[a.systemKey] = a.id;
  const generalId = accountIdOfKey.EXPENSE_GENERAL;
  const expenseByName = new Map(
    accounts.filter((a) => a.parentId === generalId).map((a) => [a.name.trim(), a.id]),
  );
  const packPayer = new Map(rawPacks.map((p) => [p.id, p.paidByUserId]));

  const ctx: PostingContext = {
    conversionDate,
    moneyAccountOf: (userId) => maOfUser.get(userId) ?? null,
    legacyHolderUserId: classroom.legacyCustodianUserId,
    defaultLocationId: liveLocations[0]?.id ?? locations[0]?.id ?? null,
    locationExists: (id) => locationIds.has(id),
    expiryUserOf: (id) => expiryUser.get(id) ?? null,
    expenseAccountOf: (category) => expenseByName.get(category.trim()) ?? null,
    packMoneyAccountOf: (packId) => {
      const payer = packPayer.get(packId);
      return payer === undefined ? null : (maOfUser.get(payer) ?? null);
    },
    moneyAccount: (id) => maById.get(id) ?? null,
  };

  const cards: CardInput[] = rawCards.map((c) => ({
    id: c.id,
    createdAt: c.createdAt,
    finalPrice: c.finalPrice,
    totalSessions: c.totalSessions,
    remainingSessions: c.remainingSessions,
    isPaid: c.isPaid,
    paidAt: c.paidAt,
    paidByUserId: c.paidByUserId,
    origin: c.origin,
    soldLocationId: c.soldLocationId,
    expiredAt: c.expiredAt,
    closedReason: c.closedReason,
    convertedToId: c.convertedToId,
    transferredToId: c.transferredToId,
    refund: c.refund,
    usages: [
      ...c.attendanceRecords.map((r) => ({
        kind: "attendance" as const,
        id: r.id,
        periodId: r.lessonPeriod.id,
        startTime: r.lessonPeriod.startTime,
        sessionsUsed: r.sessionsUsed,
        checked: r.lessonPeriod.attendanceTakenAt !== null,
      })),
      ...c.absences.map((a) => ({
        kind: "absence" as const,
        id: a.id,
        periodId: a.lessonPeriod.id,
        startTime: a.lessonPeriod.startTime,
        sessionsUsed: a.sessionsUsed,
        checked: a.lessonPeriod.attendanceTakenAt !== null,
      })),
    ],
  }));

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const usageValue = new Map<string, number>();
  const cardLoc = new Map<number, number | null>();
  for (const c of cards) {
    for (const [k, v] of cardUsageValues(c)) usageValue.set(k, v);
    cardLoc.set(c.id, cardDeferredLocation(c, ctx));
  }

  const convertedFrom = new Map<number, ConvertedFrom[]>();
  for (const c of cards) {
    const target = c.convertedToId ?? c.transferredToId;
    if (target === null || !c.expiredAt) continue;
    const loc = cardLoc.get(c.id);
    if (loc == null) continue;
    const list = convertedFrom.get(target) ?? [];
    list.push({ cardId: c.id, value: cardRemainingValue(c), locationId: loc, closedAt: c.expiredAt });
    convertedFrom.set(target, list);
  }

  const periods: PeriodInput[] = rawPeriods.map((p) => {
    const { rule } = effectiveRule(p);
    const pack = packPrices.get(p.id);
    const usages: PeriodInput["usages"] = [];
    for (const r of p.attendanceRecords) {
      if (r.dropInCharge || r.studentCardId === null) continue;
      const card = cardById.get(r.studentCardId);
      if (!card) continue;
      usages.push({
        kind: "attendance",
        id: r.id,
        cardId: card.id,
        value: usageValue.get(usageValueKey("attendance", r.id)) ?? 0,
        cardLocationId: cardLoc.get(card.id) ?? ctx.defaultLocationId ?? 0,
        paid: card.isPaid,
      });
    }
    for (const a of p.absences) {
      const card = cardById.get(a.studentCardId);
      if (!card) continue;
      usages.push({
        kind: "absence",
        id: a.id,
        cardId: card.id,
        value: usageValue.get(usageValueKey("absence", a.id)) ?? 0,
        cardLocationId: cardLoc.get(card.id) ?? ctx.defaultLocationId ?? 0,
        paid: card.isPaid,
      });
    }
    return {
      id: p.id,
      startTime: p.startTime,
      fundLocationId: rule?.fundLocationId ?? p.lesson.locationId,
      rule,
      pack: pack ? { venueId: pack.venueId, packId: pack.packId, unit: pack.unit } : null,
      usages,
      dropIns: p.attendanceRecords.flatMap((r) => (r.dropInCharge ? [r.dropInCharge] : [])),
    };
  });

  return {
    classroomId,
    ctx,
    lockDate: classroom.financeLockDate ? dateKeyOfDbDate(classroom.financeLockDate) : null,
    cards,
    convertedFrom,
    periods,
    expenses: rawExpenses,
    packs: rawPacks,
    payouts: rawPayouts.map((p) => ({
      id: p.id,
      partyType: p.partyType as PayoutInput["partyType"],
      partyId: p.partyId,
      payableKey: p.payableKey as PayoutInput["payableKey"],
      locationId: p.locationId,
      amount: p.amount,
      paidAmount: p.paidAmount,
      fromMoneyAccountId: p.fromMoneyAccountId,
      paidDate: p.paidDate ? dateKeyOfDbDate(p.paidDate) : null,
      voided: p.voidedAt !== null,
    })),
    transfers: rawTransfers.map((t) => ({
      id: t.id,
      fromMoneyAccountId: t.fromMoneyAccountId,
      toMoneyAccountId: t.toMoneyAccountId,
      amount: t.amount,
      settleAmount: t.settleAmount,
      date: t.date ? dateKeyOfDbDate(t.date) : null,
      voided: t.voidedAt !== null,
    })),
    ownerTxns: rawOwner.map((o) => ({
      id: o.id,
      kind: o.kind,
      userId: o.userId,
      amount: o.amount,
      date: dateKeyOfDbDate(o.date),
      moneyAccountId: o.moneyAccountId,
      locationId: o.locationId,
      voided: o.voidedAt !== null,
    })),
    cashCounts: rawCounts.map((c) => ({
      id: c.id,
      moneyAccountId: c.moneyAccountId,
      date: dateKeyOfDbDate(c.date),
      systemBalance: c.systemBalance,
      counted: c.counted,
      voided: c.voidedAt !== null,
    })),
    accountIdOfKey,
    accountIdOfMoney,
  };
}
