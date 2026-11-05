import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { parseTaipeiMonthRange } from "@/lib/taipei-date";
import type { Buckets, LedgerInput } from "@/domains/finance/ledger";
import type { PendingNote } from "@/domains/finance/income";
import {
  EMPTY_PERIOD_STATE,
  earliestOpenMonth,
  expiryDeltas,
  expiryStateEquals,
  monthOf,
  nextMonth,
  periodDeltas,
  periodStateEquals,
} from "@/domains/finance/months";
import type { ExpiryState, SnapshotCore, SnapshotExpiry } from "@/domains/finance/months";
import { formatCardSerial } from "@/lib/cardSerial";
import type { Allocation } from "@/domains/finance/types";
import { assertFinance, assertFinanceEnabled } from "./access";
import { custodyFromLedger, ledgerWarnings, loadLedger } from "./custody";
import type { Ledger } from "./custody";
import type { PeriodFinance } from "./periods";
import type { ExpiryTarget } from "./expiry";

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
  /** date = 那堂的開始時間（ISO 字串；鎖住的結算單從 JSON 讀回也一樣） */
  adjustments: { periodId: number; lessonName: string; date: string; deltas: Allocation[]; reason: "late" }[];
  /** 過期收入的調整：鎖住後卡的剩餘價值變了（例：取消點名退格到已過期的卡），差額算進最早沒鎖的月份。 */
  expiryAdjustments: { studentCardId: number; serial: string; deltas: { to: ExpiryTarget; amount: number }[] }[];
  byPerson: { teacherId: number; name: string; payerUserId: number | null; total: number; rounded: number }[];
  expenses: Ledger["context"]["expenses"];
  expiries: Ledger["context"]["expiries"];
  custodyBefore: Record<number, Buckets>;
  payouts: Payout[];
  warnings: StatementWarning[];
  uncheckedPeriods: number;
  pending: (PendingNote & { periodId: number; studentName: string })[];
  /** 各分部：營收（已實現）、人次、學生數、支出、公積金變化（分到的＋調整＋過期收入＋取整零頭−支出） */
  byBranch: { locationId: number | null; name: string; revenue: number; sessions: number; students: number; expenses: number; fundChange: number }[];
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
  // 進過快照的時段（例：鎖住後被改到這個月）只算調整，不重複列成這個月的時段。
  const periods = ctx.livePeriods.filter((p) => p.month === month && !ctx.baselines.has(p.periodId));
  const liveById = new Map(ctx.livePeriods.map((p) => [p.periodId, p]));

  // 調整：鎖住月份的時段，現況跟快照（基準）不同 → 差額算進最早沒鎖的月份。
  const adjustments: MonthStatement["adjustments"] = [];
  const absorbed: number[] = [];
  if (month === ctx.openMonth) {
    const lockedPeriodIds = new Set([
      ...ctx.baselines.keys(),
      ...ctx.livePeriods.filter((p) => locked.has(p.month)).map((p) => p.periodId),
    ]);
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
      // 現況沒有這堂（點名被取消、時段被刪）→ 用快照存的課名與時間；有 deltas 就一定有基準。
      const label = lp
        ? { lessonName: lp.lessonName, startTime: lp.startTime.toISOString() }
        : ctx.baselineLabels.get(periodId)!;
      adjustments.push({
        periodId,
        lessonName: label.lessonName,
        date: label.startTime,
        deltas,
        reason: "late",
      });
    }
  }

  // 過期收入的調整：進過快照的卡，現況跟快照不同 → 差額算進最早沒鎖的月份。
  const expiryAdjustments: MonthStatement["expiryAdjustments"] = [];
  const absorbedExpiries: SnapshotExpiry[] = [];
  if (month === ctx.openMonth) {
    const liveExpiry = new Map(ctx.expiries.map((e) => [e.studentCardId, e]));
    const changed: { id: number; live: ExpiryState; baseline: ExpiryState }[] = [];
    for (const [id, baseline] of [...ctx.expiryBaselines].sort(([a], [b]) => a - b)) {
      const e = liveExpiry.get(id);
      const live: ExpiryState = e ? { value: e.value, holderUserId: e.holderUserId, to: e.to } : { ...baseline, value: 0 };
      if (expiryStateEquals(live, baseline)) continue;
      absorbedExpiries.push({ id, ...live });
      changed.push({ id, live, baseline });
    }
    const serials = new Map(
      (
        await prisma.studentCard.findMany({
          where: { id: { in: changed.map((c) => c.id) } },
          select: { id: true, serialNumber: true },
        })
      ).map((c) => [c.id, formatCardSerial(c.serialNumber)]),
    );
    for (const { id, live, baseline } of changed) {
      const deltas = expiryDeltas(live, baseline);
      if (deltas.length > 0) expiryAdjustments.push({ studentCardId: id, serial: serials.get(id) ?? "", deltas });
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

  const pendingRaw = periods.flatMap((p) => p.income.pending.map((n) => ({ ...n, periodId: p.periodId })));
  const studentRows = await prisma.student.findMany({
    where: { classroomId, id: { in: [...new Set(pendingRaw.map((n) => n.studentId))] } },
    select: { id: true, name: true },
  });
  const studentName = new Map(studentRows.map((st) => [st.id, st.name]));

  // 各分部
  const acc = new Map<number | null, { revenue: number; sessions: number; students: Set<number>; expenses: number; fundChange: number }>();
  const slot = (id: number | null) => {
    if (!acc.has(id)) acc.set(id, { revenue: 0, sessions: 0, students: new Set(), expenses: 0, fundChange: 0 });
    return acc.get(id)!;
  };
  const addFund = (allocations: Allocation[]) => {
    for (const a of allocations) if (a.payee.type === "fund") slot(a.payee.locationId).fundChange += a.amount;
  };
  for (const p of periods) {
    const b = slot(p.locationId);
    b.revenue += p.income.total;
    b.sessions += p.income.realized.length;
    for (const r of p.income.realized) b.students.add(r.studentId);
    addFund(p.allocations ?? []);
  }
  for (const a of adjustments) addFund(a.deltas);
  for (const e of ctx.expenses.filter((x) => expenseIds.has(x.id))) {
    const b = slot(e.locationId);
    b.expenses += e.amount;
    b.fundChange -= e.amount;
  }
  for (const x of ctx.expiries.filter((e) => expiryIds.has(e.studentCardId))) {
    if (x.to.type === "fund") slot(x.to.locationId).fundChange += x.value;
  }
  for (const a of expiryAdjustments) {
    for (const d of a.deltas) if (d.to.type === "fund") slot(d.to.locationId).fundChange += d.amount;
  }
  for (const r of roundings) slot(r.locationId).fundChange += r.amount;
  const branchNames = new Map(
    (await prisma.location.findMany({ where: { classroomId }, select: { id: true, name: true } })).map((l) => [l.id, l.name]),
  );
  const byBranch: MonthStatement["byBranch"] = [...acc.entries()]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([locationId, v]) => ({
      locationId,
      name: locationId === null ? "未指定分部" : (branchNames.get(locationId) ?? "分部"),
      revenue: v.revenue,
      sessions: v.sessions,
      students: v.students.size,
      expenses: v.expenses,
      fundChange: v.fundChange,
    }));

  const statement: MonthStatement = {
    month,
    locked: false,
    periods,
    adjustments,
    expiryAdjustments,
    byPerson,
    expenses: ctx.expenses.filter((e) => expenseIds.has(e.id)),
    expiries: ctx.expiries.filter((e) => expiryIds.has(e.studentCardId)),
    custodyBefore,
    payouts,
    warnings,
    uncheckedPeriods,
    pending: pendingRaw.map((n) => ({ ...n, studentName: studentName.get(n.studentId) ?? "學生" })),
    byBranch,
  };

  const snapPeriods: SnapshotCore["periods"] = {};
  const snapIncome: SnapshotCore["income"] = {};
  const snapLabels: SnapshotCore["labels"] = {};
  for (const periodId of [...periods.map((p) => p.periodId), ...absorbed]) {
    const state = ctx.liveStates.get(periodId) ?? EMPTY_PERIOD_STATE;
    snapPeriods[periodId] = state.allocations;
    snapIncome[periodId] = state.income;
    const lp = liveById.get(periodId);
    const label = lp ? { lessonName: lp.lessonName, startTime: lp.startTime.toISOString() } : ctx.baselineLabels.get(periodId);
    if (label) snapLabels[periodId] = label;
  }
  const newEventIds = (kind: keyof SnapshotCore["eventIds"]) =>
    ctx.events[kind].filter((e) => e.month === month && !e.snapshotted).map((e) => e.id);
  const liveExpiry = new Map(ctx.expiries.map((e) => [e.studentCardId, e]));
  const snapshot: SnapshotCore = {
    periods: snapPeriods,
    income: snapIncome,
    labels: snapLabels,
    eventIds: {
      // 新的過期收入連同當時的價值一起存；進過快照、這次有差額的卡存新的基準。
      expiries: [
        ...newEventIds("expiries").map((id): SnapshotExpiry => {
          const e = liveExpiry.get(id)!;
          return { id, value: e.value, holderUserId: e.holderUserId, to: e.to };
        }),
        ...absorbedExpiries,
      ],
      expenses: newEventIds("expenses"),
      refunds: newEventIds("refunds"),
      transfers: newEventIds("transfers"),
    },
    roundings,
    prepaid: Object.entries(custodyBefore)
      .filter(([, b]) => b.prepaid !== 0)
      .map(([userId, b]) => ({ holderUserId: Number(userId), value: b.prepaid })),
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

/**
 * 作廢支出／轉帳／次數包前呼叫：事件日期的月份已鎖，或它已經進了某份月結快照 → 409 MONTH_LOCKED
 * （鎖住的月份永遠不變；ruling R20 選擇擋下而不是產生調整）。
 */
export async function assertVoidable(
  classroomId: number,
  { date, kind, id }: { date: Date; kind?: "expenses" | "transfers"; id?: number },
): Promise<void> {
  const rows = await prisma.financeSettlement.findMany({
    where: { classroomId },
    select: { month: true, snapshot: true },
  });
  const month = monthOf(date);
  const inSnapshot =
    kind !== undefined &&
    id !== undefined &&
    rows.some((r) => (r.snapshot as unknown as SnapshotCore).eventIds[kind].includes(id));
  if (inSnapshot || rows.some((r) => r.month === month)) {
    throw new ApiError(409, "MONTH_LOCKED", "This month is locked");
  }
}
