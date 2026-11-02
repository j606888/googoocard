import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { parseTaipeiMonthRange } from "@/lib/taipei-date";
import type { Buckets, LedgerInput } from "@/domains/finance/ledger";
import type { PendingNote } from "@/domains/finance/income";
import { EMPTY_PERIOD_STATE, earliestOpenMonth, monthOf, nextMonth, periodDeltas, periodStateEquals } from "@/domains/finance/months";
import type { SnapshotCore } from "@/domains/finance/months";
import type { Allocation } from "@/domains/finance/types";
import { assertFinance, assertFinanceEnabled } from "./access";
import { custodyFromLedger, ledgerWarnings, loadLedger } from "./custody";
import type { Ledger } from "./custody";
import type { PeriodFinance } from "./periods";

// 月結（spec §7.2–7.5）：結算單、鎖定與快照、鎖住後的調整、發錢取整。

const EPSILON = 0.005;

export type StatementWarning = "UNALLOCATED" | "UNCHECKED_PERIODS" | "NO_PACK" | "PACK_OVERDRAWN";

export type Payout = {
  fromUserId: number;
  toKind: "USER" | "TEACHER" | "SELF" | "VENUE";
  toUserId?: number;
  toTeacherId?: number;
  toVenueId?: number;
  amount: number; // 整數元，按「已轉」直接建 FinanceTransfer
};

export type MonthStatement = {
  month: string;
  locked: boolean;
  periods: PeriodFinance[];
  adjustments: { periodId: number; lessonName: string; date: Date; deltas: Allocation[]; reason: "late" }[];
  byPerson: { teacherId: number; name: string; payerUserId: number | null; total: number; rounded: number }[];
  expenses: Ledger["context"]["expenses"];
  expiries: Ledger["context"]["expiries"];
  custodyBefore: Record<number, Buckets>;
  payouts: Payout[];
  warnings: StatementWarning[];
  uncheckedPeriods: number;
  pending: (PendingNote & { periodId: number })[];
};

export type SettlementSnapshot = SnapshotCore & { statement: MonthStatement };

const roundToUnit = (x: number, unit: number) => Math.round(x / unit) * unit;

/** 每位保管人要轉／發的錢；老師與自己的取整到 roundTo，零頭記成 roundings 進付款人負責分部的公積金。 */
function computePayouts(
  custody: Record<number, Buckets>,
  roundTo: number,
  branchOf: Map<number, number>,
  month: string,
): { payouts: Payout[]; roundings: LedgerInput["roundings"] } {
  const payouts: Payout[] = [];
  const roundings: LedgerInput["roundings"] = [];
  const userIds = Object.keys(custody).map(Number).sort((a, b) => a - b);
  for (const userId of userIds) {
    const b = custody[userId];
    const locationId = branchOf.get(userId);
    const rounded = (amount: number, bucket: "self" | "teacher", teacherId?: number) => {
      const r = roundToUnit(amount, roundTo);
      // 付款人沒有負責的分部：零頭留在原本那格。
      if (locationId !== undefined && Math.abs(amount - r) >= EPSILON) {
        roundings.push({ userId, locationId, bucket, ...(teacherId !== undefined ? { teacherId } : {}), amount: amount - r, month });
      }
      return r;
    };
    if (b.self >= EPSILON) {
      const amount = rounded(b.self, "self");
      if (amount > 0) payouts.push({ fromUserId: userId, toKind: "SELF", toUserId: userId, amount });
    }
    for (const [id, value] of Object.entries(b.teachers)) {
      if (value < EPSILON) continue;
      const teacherId = Number(id);
      const amount = rounded(value, "teacher", teacherId);
      if (amount > 0) payouts.push({ fromUserId: userId, toKind: "TEACHER", toTeacherId: teacherId, amount });
    }
    for (const [id, value] of Object.entries(b.peers)) {
      const amount = Math.round(value);
      if (amount > 0) payouts.push({ fromUserId: userId, toKind: "USER", toUserId: Number(id), amount });
    }
    for (const [id, value] of Object.entries(b.venues)) {
      const amount = Math.round(value);
      if (amount > 0) payouts.push({ fromUserId: userId, toKind: "VENUE", toVenueId: Number(id), amount });
    }
  }
  return { payouts, roundings };
}

/** 還沒鎖的月份即時算；回傳結算單＋鎖定時要存的東西。 */
async function computeStatement(
  classroomId: number,
  month: string,
  now: Date,
  ledger: Ledger,
): Promise<{ statement: MonthStatement; snapshot: SnapshotCore }> {
  const { financeEnabledAt, financeRoundTo } = await assertFinanceEnabled(classroomId);
  const ctx = ledger.context;
  const locked = new Set(ctx.lockedMonths);
  const periods = ctx.livePeriods.filter((p) => p.month === month);

  // 調整：鎖住月份的時段，現況跟快照（基準）不同 → 差額算進最早沒鎖的月份。
  const adjustments: MonthStatement["adjustments"] = [];
  const absorbed: number[] = [];
  if (month === ctx.openMonth) {
    const lockedPeriodIds = new Set([
      ...ctx.baselines.keys(),
      ...ctx.livePeriods.filter((p) => locked.has(p.month)).map((p) => p.periodId),
    ]);
    const liveById = new Map(ctx.livePeriods.map((p) => [p.periodId, p]));
    const missing = [...lockedPeriodIds].filter((id) => !liveById.has(id));
    const gone = new Map(
      (
        await prisma.lessonPeriod.findMany({
          where: { id: { in: missing } },
          select: { id: true, startTime: true, lesson: { select: { name: true } } },
        })
      ).map((p) => [p.id, p]),
    );
    for (const periodId of [...lockedPeriodIds].sort((a, b) => a - b)) {
      const live = ctx.liveStates.get(periodId) ?? EMPTY_PERIOD_STATE;
      const baseline = ctx.baselines.get(periodId) ?? EMPTY_PERIOD_STATE;
      if (periodStateEquals(live, baseline)) continue;
      absorbed.push(periodId);
      const deltas = periodDeltas(
        new Map([[periodId, live.allocations ?? []]]),
        new Map([[periodId, baseline.allocations ?? []]]),
      ).get(periodId);
      if (!deltas) continue;
      const lp = liveById.get(periodId);
      const gp = gone.get(periodId);
      adjustments.push({
        periodId,
        lessonName: lp?.lessonName ?? gp?.lesson.name ?? "",
        date: lp?.startTime ?? gp?.startTime ?? new Date(0),
        deltas,
        reason: "late",
      });
    }
  }

  // 每位老師這個月的合計（各堂＋調整）
  const teacherTotals = new Map<number, number>();
  const addTeacher = (allocations: Allocation[]) => {
    for (const a of allocations) {
      if (a.payee.type !== "teacher") continue;
      teacherTotals.set(a.payee.teacherId, (teacherTotals.get(a.payee.teacherId) ?? 0) + a.amount);
    }
  };
  for (const p of periods) addTeacher(p.allocations ?? []);
  for (const a of adjustments) addTeacher(a.deltas);
  const teachers = await prisma.teacher.findMany({
    where: { classroomId, id: { in: [...teacherTotals.keys()] } },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  const byPerson = teachers.map((t) => {
    const total = teacherTotals.get(t.id) ?? 0;
    return {
      teacherId: t.id,
      name: t.name,
      payerUserId: ledger.keepers.teacherPayer[t.id] ?? null,
      total,
      rounded: roundToUnit(total, financeRoundTo),
    };
  });

  const eventsIn = (kind: keyof SnapshotCore["eventIds"]) =>
    new Set(ctx.events[kind].filter((e) => e.month === month).map((e) => e.id));
  const expenseIds = eventsIn("expenses");
  const expiryIds = eventsIn("expiries");

  const custody = await custodyFromLedger(classroomId, ledger, month);
  const custodyBefore = Object.fromEntries(custody.users.map((u) => [u.userId, u.buckets]));

  const branches = await prisma.location.findMany({
    where: { classroomId, archivedAt: null, keeperUserId: { not: null } },
    select: { id: true, keeperUserId: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const branchOf = new Map<number, number>();
  for (const l of branches) if (!branchOf.has(l.keeperUserId!)) branchOf.set(l.keeperUserId!, l.id);
  const { payouts, roundings } = computePayouts(custodyBefore, financeRoundTo, branchOf, month);

  const { start, end } = parseTaipeiMonthRange(month);
  const uncheckedPeriods = await prisma.lessonPeriod.count({
    where: {
      lesson: { classroomId },
      attendanceTakenAt: null,
      startTime: { gte: start > financeEnabledAt ? start : financeEnabledAt, lt: end < now ? end : now },
    },
  });

  const warnings: StatementWarning[] = [];
  const unallocated =
    Object.values(custodyBefore).some((b) => Math.abs(b.unallocated) >= EPSILON) ||
    ledgerWarnings(ledger.input, ledger.keepers, month).some((w) => w.code === "UNRESOLVED_KEEPER");
  if (unallocated) warnings.push("UNALLOCATED");
  if (uncheckedPeriods > 0) warnings.push("UNCHECKED_PERIODS");
  for (const code of ["NO_PACK", "PACK_OVERDRAWN"] as const) {
    if (periods.some((p) => p.warnings.includes(code))) warnings.push(code);
  }

  const statement: MonthStatement = {
    month,
    locked: false,
    periods,
    adjustments,
    byPerson,
    expenses: ctx.expenses.filter((e) => expenseIds.has(e.id)),
    expiries: ctx.expiries.filter((e) => expiryIds.has(e.studentCardId)),
    custodyBefore,
    payouts,
    warnings,
    uncheckedPeriods,
    pending: periods.flatMap((p) => p.income.pending.map((n) => ({ ...n, periodId: p.periodId }))),
  };

  const snapPeriods: SnapshotCore["periods"] = {};
  const snapIncome: SnapshotCore["income"] = {};
  for (const periodId of [...periods.map((p) => p.periodId), ...absorbed]) {
    const state = ctx.liveStates.get(periodId) ?? EMPTY_PERIOD_STATE;
    snapPeriods[periodId] = state.allocations;
    snapIncome[periodId] = state.income;
  }
  const newEventIds = (kind: keyof SnapshotCore["eventIds"]) =>
    ctx.events[kind].filter((e) => e.month === month && !e.snapshotted).map((e) => e.id);
  const snapshot: SnapshotCore = {
    periods: snapPeriods,
    income: snapIncome,
    eventIds: {
      expiries: newEventIds("expiries"),
      expenses: newEventIds("expenses"),
      refunds: newEventIds("refunds"),
      transfers: newEventIds("transfers"),
    },
    roundings,
  };
  return { statement, snapshot };
}

const toJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** 結算單：鎖住的月份讀快照（永遠不變）；其他月份即時算。 */
export async function getMonthStatement(classroomId: number, month: string, now = new Date()): Promise<MonthStatement> {
  await assertFinanceEnabled(classroomId);
  const row = await prisma.financeSettlement.findUnique({
    where: { classroomId_month: { classroomId, month } },
    select: { snapshot: true },
  });
  if (row) return (row.snapshot as unknown as SettlementSnapshot).statement;
  const { statement } = await computeStatement(classroomId, month, now, await loadLedger(classroomId));
  return statement;
}

/** 確認結算：只能鎖最早沒鎖、而且已經結束（台北）的月份；有未分配的錢不能鎖。 */
export async function lockMonth({
  classroomId,
  userId,
  month,
  now = new Date(),
}: {
  classroomId: number;
  userId: number;
  month: string;
  now?: Date;
}): Promise<MonthStatement> {
  await assertFinance(userId, classroomId);
  const ledger = await loadLedger(classroomId);
  if (month !== ledger.context.openMonth) {
    throw new ApiError(409, "MONTH_NOT_OPEN", `Only ${ledger.context.openMonth} can be locked`);
  }
  if (now < parseTaipeiMonthRange(month).end) {
    throw new ApiError(409, "MONTH_NOT_ENDED", "The month has not ended yet");
  }
  const { statement, snapshot } = await computeStatement(classroomId, month, now, ledger);
  if (statement.warnings.includes("UNALLOCATED")) {
    throw new ApiError(409, "UNALLOCATED", "Some money has no one to go to");
  }
  const data: SettlementSnapshot = toJson({ ...snapshot, statement: { ...statement, locked: true } });
  try {
    // 回傳存進去的那份（JSON 存取會改到浮點數最後幾位），之後讀結算單才會一模一樣。
    const row = await prisma.financeSettlement.create({
      data: {
        classroomId,
        month,
        lockedAt: now,
        lockedById: userId,
        snapshot: data as unknown as Prisma.InputJsonValue,
      },
      select: { snapshot: true },
    });
    return (row.snapshot as unknown as SettlementSnapshot).statement;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "MONTH_NOT_OPEN", "This month is already locked");
    }
    throw e;
  }
}

/** 上線月份到這個月（台北）每個月的結算狀態。 */
export async function listSettlementMonths(classroomId: number, now = new Date()) {
  const { financeEnabledAt } = await assertFinanceEnabled(classroomId);
  const rows = await prisma.financeSettlement.findMany({
    where: { classroomId },
    select: { month: true, lockedAt: true, lockedById: true },
  });
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const current = monthOf(now);
  const months: { month: string; locked: boolean; lockedAt: Date | null; lockedById: number | null }[] = [];
  for (let m = monthOf(financeEnabledAt); m <= current || byMonth.has(m); m = nextMonth(m)) {
    const r = byMonth.get(m);
    months.push({ month: m, locked: !!r, lockedAt: r?.lockedAt ?? null, lockedById: r?.lockedById ?? null });
  }
  return { openMonth: earliestOpenMonth(monthOf(financeEnabledAt), [...byMonth.keys()]), months };
}
