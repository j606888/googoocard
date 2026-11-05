import prisma from "@/lib/prisma";
import { cardUnitValue } from "@/domains/finance/income";
import { computeCustody, emptyBuckets, resolvePayee } from "@/domains/finance/ledger";
import type { Buckets, Keepers, LedgerInput } from "@/domains/finance/ledger";
import {
  EMPTY_PERIOD_STATE,
  assignMonth,
  earliestOpenMonth,
  expiryHistoryEntries,
  monthOf,
  periodHistoryEntries,
  snapshotEventIds,
  snapshotExpiries,
} from "@/domains/finance/months";
import type { ExpiryState, PeriodState, SnapshotCore } from "@/domains/finance/months";
import { assertFinanceEnabled } from "./access";
import { expireDueCards, expiryEvents } from "./expiry";
import type { ExpiryEvent } from "./expiry";
import { loadPeriodFinance } from "./periods";
import type { PeriodFinance } from "./periods";

export type CustodyWarning =
  // 找不到該付的人（老師沒設付款人、分部沒設負責人…）：錢先放在 holder 的「未分配」
  | { code: "UNRESOLVED_KEEPER"; periodId?: number; locationId?: number }
  // 已付款的錢找不到保管人（沒有收款人、也沒設開帳保管人）：不進任何人的表
  | { code: "UNKNOWN_HOLDER"; periodId?: number; studentCardId?: number };

export type CustodyUser = { userId: number; name: string; buckets: Buckets };

type EventKind = keyof SnapshotCore["eventIds"];
/** 一筆事件算進的月份；snapshotted = 已經在某份月結快照裡。 */
export type AssignedEvent = { id: number; month: string; snapshotted: boolean };

/** 月結的狀態（Task 13）：鎖了哪些月、每堂的基準與現況、每筆事件算進哪個月。 */
export type SettlementContext = {
  launchMonth: string;
  lockedMonths: string[];
  openMonth: string;
  livePeriods: PeriodFinance[];
  liveStates: Map<number, PeriodState>;
  /** 時段 → 最新一份包含它的快照裡的狀態 */
  baselines: Map<number, PeriodState>;
  /** 時段 → 最新一份包含它的快照裡的課名／開始時間 */
  baselineLabels: Map<number, { lessonName: string; startTime: string }>;
  events: Record<EventKind, AssignedEvent[]>;
  expenses: { id: number; date: Date; amount: number; locationId: number; category: string; paidByUserId: number }[];
  expiries: ExpiryEvent[];
  /** 卡 → 最新一份包含它的快照裡的過期收入（只有新格式的快照） */
  expiryBaselines: Map<number, ExpiryState>;
  /** 已鎖月份 → 鎖住當時的預收（舊快照沒有） */
  lockedPrepaid: Map<string, LedgerInput["prepaid"]>;
};

export type Ledger = {
  input: LedgerInput;
  keepers: Keepers;
  warnings: CustodyWarning[];
  context: SettlementContext;
};

/**
 * 組 computeCustody 的輸入與負責人表。月份照 spec §7.3：事件月份已鎖 → 最早沒鎖的月份；
 * 已鎖月份的時段照快照當基準，之後的變動當差額算進最早沒鎖的月份（periodHistoryEntries）。
 */
export async function loadLedger(classroomId: number): Promise<Ledger> {
  const { financeEnabledAt, legacyCustodianUserId } = await assertFinanceEnabled(classroomId);
  await expireDueCards(classroomId);
  const warnings: CustodyWarning[] = [];

  const untakenPeriod = { lesson: { classroomId }, attendanceTakenAt: null, startTime: { gte: financeEnabledAt } };
  const paidCard = { select: { isPaid: true, finalPrice: true, totalSessions: true, paidByUserId: true } };
  const [periods, expiries, cards, expenses, packs, transfers, refunds, locations, venues, teachers, financeMembers, untakenRecords, untakenAbsences, settlements] =
    await Promise.all([
      loadPeriodFinance(classroomId, {}),
      expiryEvents(classroomId),
      prisma.studentCard.findMany({
        where: { student: { classroomId }, isPaid: true, expiredAt: null, remainingSessions: { gt: 0 } },
        select: { id: true, finalPrice: true, totalSessions: true, remainingSessions: true, paidByUserId: true },
      }),
      prisma.financeExpense.findMany({
        where: { classroomId, voidedAt: null },
        select: { id: true, amount: true, locationId: true, category: true, paidByUserId: true, date: true },
      }),
      prisma.venuePack.findMany({
        where: { classroomId },
        select: { id: true, price: true, paidByUserId: true, voidedAt: true },
      }),
      prisma.financeTransfer.findMany({
        where: { classroomId, voidedAt: null },
        select: {
          id: true,
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
        select: { id: true, amount: true, paidByUserId: true, date: true, studentCard: { select: { paidByUserId: true } } },
      }),
      prisma.location.findMany({
        where: { classroomId },
        select: { id: true, keeperUserId: true, fundOpening: true },
      }),
      prisma.venue.findMany({ where: { classroomId }, select: { id: true, landlordUserId: true } }),
      prisma.teacher.findMany({ where: { classroomId }, select: { id: true, userId: true, payerUserId: true } }),
      prisma.membership.findMany({ where: { classroomId, isFinance: true }, select: { userId: true } }),
      prisma.attendanceRecord.findMany({
        where: { lessonPeriod: untakenPeriod },
        select: {
          sessionsUsed: true,
          studentCard: paidCard,
          dropInCharge: { select: { id: true, amount: true, isPaid: true, paidByUserId: true } },
        },
      }),
      prisma.attendanceAbsence.findMany({
        where: { lessonPeriod: untakenPeriod },
        select: { sessionsUsed: true, studentCard: paidCard },
      }),
      prisma.financeSettlement.findMany({
        where: { classroomId },
        select: { month: true, snapshot: true },
        orderBy: { month: "asc" },
      }),
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
  // 還沒點名定案的時段（例：自助簽到）已經扣了格、但還不算收入：那份錢仍當作預收，
  // 定案（attendanceTakenAt）後才移到那堂的已實現收入。已付的單堂同理。
  const pendingSources = [
    ...untakenRecords.map((r) =>
      r.dropInCharge
        ? { paid: r.dropInCharge.isPaid, value: r.dropInCharge.amount, paidByUserId: r.dropInCharge.paidByUserId }
        : r.studentCard
          ? { paid: r.studentCard.isPaid, value: cardUnitValue(r.studentCard) * r.sessionsUsed, paidByUserId: r.studentCard.paidByUserId }
          : null,
    ),
    ...untakenAbsences.map((a) => ({
      paid: a.studentCard.isPaid,
      value: cardUnitValue(a.studentCard) * a.sessionsUsed,
      paidByUserId: a.studentCard.paidByUserId,
    })),
  ];
  for (const src of pendingSources) {
    if (!src || !src.paid || src.value === 0) continue;
    const holder = src.paidByUserId ?? legacyCustodianUserId;
    if (holder === null) warnings.push({ code: "UNKNOWN_HOLDER" });
    else prepaid.push({ holderUserId: holder, value: src.value });
  }
  for (const e of expiries) {
    if (e.holderUserId === null) warnings.push({ code: "UNKNOWN_HOLDER", studentCardId: e.studentCardId });
  }

  // 月份歸屬
  const snapshots = settlements.map((s) => ({ month: s.month, snapshot: s.snapshot as unknown as SnapshotCore }));
  const launchMonth = monthOf(financeEnabledAt);
  const lockedMonths = snapshots.map((s) => s.month);
  const locked = new Set(lockedMonths);
  const openMonth = earliestOpenMonth(launchMonth, lockedMonths);

  const snapshotMonthOf = (kind: EventKind) => {
    const m = new Map<number, string>();
    for (const s of snapshots) for (const id of snapshotEventIds(s.snapshot, kind)) m.set(id, s.month);
    return m;
  };
  const assignEvents = (kind: EventKind, rows: { id: number; date: Date }[]): AssignedEvent[] => {
    const inSnapshot = snapshotMonthOf(kind);
    return rows.map((r) => {
      const month = inSnapshot.get(r.id);
      return month !== undefined
        ? { id: r.id, month, snapshotted: true }
        : { id: r.id, month: assignMonth(monthOf(r.date), locked, openMonth), snapshotted: false };
    });
  };
  const events: SettlementContext["events"] = {
    expiries: assignEvents("expiries", expiries.map((e) => ({ id: e.studentCardId, date: e.date }))),
    expenses: assignEvents("expenses", expenses),
    refunds: assignEvents("refunds", refunds),
    transfers: assignEvents("transfers", transfers),
  };
  const monthOfEvent = (kind: EventKind) => {
    const m = new Map(events[kind].map((e) => [e.id, e.month]));
    return (id: number) => m.get(id)!;
  };

  // 每堂：快照裡的各版本 → 現況
  const liveStates = new Map<number, PeriodState>(
    periods.map((p) => [p.periodId, { income: p.income.realized, allocations: p.allocations }]),
  );
  const chains = new Map<number, { month: string; state: PeriodState }[]>();
  for (const { month, snapshot } of snapshots) {
    for (const [id, allocations] of Object.entries(snapshot.periods)) {
      const periodId = Number(id);
      const chain = chains.get(periodId) ?? [];
      chain.push({ month, state: { income: snapshot.income[id] ?? [], allocations } });
      chains.set(periodId, chain);
    }
  }
  const baselines = new Map([...chains].map(([id, chain]) => [id, chain[chain.length - 1].state]));
  const baselineLabels = new Map<number, { lessonName: string; startTime: string }>();
  for (const { snapshot } of snapshots) {
    for (const [id, label] of Object.entries(snapshot.labels ?? {})) baselineLabels.set(Number(id), label);
  }
  // 進過快照的時段：之後的變動一律是最早沒鎖月份的調整（就算時段被改到別的月份），跟結算單一致。
  const liveMonth = new Map(
    periods.map((p) => [p.periodId, chains.has(p.periodId) ? openMonth : assignMonth(p.month, locked, openMonth)]),
  );
  const periodEntries: LedgerInput["periods"] = [];
  for (const periodId of new Set([...liveStates.keys(), ...chains.keys()])) {
    const live = liveStates.get(periodId);
    periodEntries.push(
      ...periodHistoryEntries(periodId, [
        ...(chains.get(periodId) ?? []),
        live ? { month: liveMonth.get(periodId)!, state: live } : { month: openMonth, state: EMPTY_PERIOD_STATE },
      ]),
    );
  }

  // 過期收入：快照存了當時的價值 → 跟時段一樣，之後的變動（例：退格到已過期的卡）沖銷＋重記在最早沒鎖的月份。
  const expiryChains = new Map<number, { month: string; state: ExpiryState }[]>();
  for (const { month, snapshot } of snapshots) {
    for (const { id, state } of snapshotExpiries(snapshot)) {
      if (!state) continue;
      const chain = expiryChains.get(id) ?? [];
      chain.push({ month, state });
      expiryChains.set(id, chain);
    }
  }
  const expiryBaselines = new Map([...expiryChains].map(([id, chain]) => [id, chain[chain.length - 1].state]));
  const expiryMonth = monthOfEvent("expiries");
  const liveExpiries = new Map(expiries.map((e) => [e.studentCardId, e]));
  const expiryEntries: LedgerInput["expiries"] = [];
  for (const id of new Set([...liveExpiries.keys(), ...expiryChains.keys()])) {
    const live = liveExpiries.get(id);
    const chain = expiryChains.get(id);
    if (!chain) {
      expiryEntries.push({ ...live!, month: expiryMonth(id) });
      continue;
    }
    const last = chain[chain.length - 1].state;
    const liveState: ExpiryState = live
      ? { value: live.value, holderUserId: live.holderUserId, to: live.to }
      : { ...last, value: 0 };
    expiryEntries.push(...expiryHistoryEntries(id, [...chain, { month: openMonth, state: liveState }]));
  }

  const expenseMonth = monthOfEvent("expenses");
  const refundMonth = monthOfEvent("refunds");
  const transferMonth = monthOfEvent("transfers");

  const input: LedgerInput = {
    periods: periodEntries,
    prepaid,
    expiries: expiryEntries,
    expenses: expenses.map((e) => ({
      amount: e.amount,
      locationId: e.locationId,
      paidByUserId: e.paidByUserId,
      month: expenseMonth(e.id),
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
      month: transferMonth(t.id),
    })),
    refunds: refunds.map((r) => ({
      amount: r.amount,
      paidByUserId: r.paidByUserId,
      holderUserId: r.studentCard.paidByUserId ?? legacyCustodianUserId,
      month: refundMonth(r.id),
    })),
    fundOpening: Object.fromEntries(locations.map((l) => [l.id, l.fundOpening])),
    roundings: snapshots.flatMap((s) => s.snapshot.roundings),
  };

  return {
    input,
    keepers,
    warnings,
    context: {
      launchMonth,
      lockedMonths,
      openMonth,
      livePeriods: periods,
      liveStates,
      baselines,
      baselineLabels,
      events,
      expenses,
      expiries,
      expiryBaselines,
      lockedPrepaid: new Map(snapshots.flatMap((s) => (s.snapshot.prepaid ? [[s.month, s.snapshot.prepaid]] : []))),
    },
  };
}

/** computeCustody 會把找不到負責人的錢放進未分配；這裡列出是哪些，給畫面提醒。 */
export function ledgerWarnings(input: LedgerInput, keepers: Keepers, through?: string): CustodyWarning[] {
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
    // 沒有收入、但有固定金額要付（基金吸收）：要靠分部負責人當 holder，沒有就記不進去。
    const realized = p.income.reduce((sum, s) => sum + (s.paid ? s.amount : 0), 0);
    if (
      realized === 0 &&
      p.allocations?.some((a) => a.amount !== 0) &&
      keepers.branchKeeperOfPeriod(p.periodId) === null
    ) {
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
  return custodyFromLedger(classroomId, await loadLedger(classroomId), through);
}

/** getCustody 的計算部分：已經有 loadLedger 結果時（例：結算單）不必重讀。 */
export async function custodyFromLedger(
  classroomId: number,
  { input, keepers, warnings, context }: Ledger,
  through?: string,
): Promise<{ users: CustodyUser[]; warnings: CustodyWarning[] }> {
  // 已鎖月份：預收用鎖住當時的（現在的預收含之後買的卡、少了之後上的課）。
  const lockedPrepaid = through ? context.lockedPrepaid.get(through) : undefined;
  const custody = computeCustody(
    lockedPrepaid ? { ...input, prepaid: lockedPrepaid } : input,
    keepers,
    through ? { through } : undefined,
  );

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
