import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, badRequest, notFound } from "@/lib/apiError";
import { computeSplit } from "@/domains/finance/split";
import { branchIncome, periodFlows, roundCents, type Flow, type Pile } from "@/domains/finance/flows";
import type { Allocation, ResolvedLine, SplitRule } from "@/domains/finance/types";
import { EMPTY_RULE } from "@/domains/finance/types";
import { parseRule } from "./rules";

/**
 * 一堂課（一個時段）的錢：收入依卡錢的分部分堆、照規則分、算出分部之間的往來
 * （docs/finance-lite.md §4–5）。已結清的時段回傳結清當下的快照。
 */

export type PeriodWarning =
  | "NO_LOCATION" // 課程沒有分部
  | "NOT_STARTED" // 分部還沒到轉換日（或沒設轉換日）
  | "NOT_TAKEN" // 還沒點名
  | "NO_RULE" // 這門課沒有分帳規則
  | "NO_CARD" // 有人出席沒卡也沒付單堂
  | "CARD_UNPAID" // 有卡還沒付款
  | "DROPIN_UNPAID" // 單堂還沒付
  | "CARD_NO_BRANCH" // 有卡沒指定錢的分部（先算開課分部）
  | "NO_PACK" // 場地要用次數包但沒有包
  | "NO_KEEPER"; // 開課分部沒有負責人（沒有預設付款人）

export type PeriodRecord = {
  studentId: number;
  studentName: string;
  kind: "card" | "dropIn" | "none";
  studentCardId: number | null;
  serialNumber: number | null;
  amount: number;
  locationId: number;
  unpaid: boolean;
};

export type PeriodSnapshot = {
  version: 1;
  income: number;
  piles: Pile[];
  records: PeriodRecord[];
  ruleSource: "override" | "lesson" | "none";
  allocations: Allocation[];
  branchIncome: { locationId: number; amount: number }[];
  flows: Flow[];
  warnings: PeriodWarning[];
};

export type PeriodFinance = PeriodSnapshot & {
  periodId: number;
  lessonId: number;
  lessonName: string;
  startTime: Date;
  lessonLocationId: number | null;
  /** 這堂算不算錢（有分部、過了轉換日、點了名）。 */
  counted: boolean;
  defaultPayerUserId: number | null;
  settlement: {
    paidByUserId: number;
    payerLocationId: number;
    settledAt: Date;
    /** 結清後點名或規則又改了：現在算出來的收入跟快照不一樣。 */
    changed: boolean;
  } | null;
};

const periodInclude = {
  lesson: {
    select: {
      id: true,
      name: true,
      classroomId: true,
      locationId: true,
      location: { select: { id: true, keeperUserId: true, financeStartAt: true } },
      splitRule: { select: { rule: true } },
    },
  },
  splitOverride: { select: { rule: true } },
  settlement: true,
  attendanceRecords: {
    select: {
      sessionsUsed: true,
      student: { select: { id: true, name: true } },
      studentCard: {
        select: {
          id: true,
          serialNumber: true,
          finalPrice: true,
          totalSessions: true,
          isPaid: true,
          moneyLocationId: true,
        },
      },
      dropInCharge: { select: { amount: true, isPaid: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.LessonPeriodInclude;

type LoadedPeriod = Prisma.LessonPeriodGetPayload<{ include: typeof periodInclude }>;

type VenueInfo = {
  id: number;
  locationId: number | null;
  perSessionPrice: number | null;
  packs: { id: number; sessions: number; price: number; remainingAtStart: number | null }[];
};

/** 每個次數包已經被結清的課用掉幾次。 */
export async function packUsage(classroomId: number, excludePeriodId?: number) {
  const settled = await prisma.periodSettlement.findMany({
    where: { lessonPeriod: { lesson: { classroomId } }, ...(excludePeriodId ? { NOT: { lessonPeriodId: excludePeriodId } } : {}) },
    select: { snapshot: true },
  });
  const used = new Map<number, number>();
  for (const s of settled) {
    for (const a of (s.snapshot as unknown as PeriodSnapshot).allocations ?? []) {
      if (a.payee.type === "venue" && a.payee.packId !== undefined) {
        used.set(a.payee.packId, (used.get(a.payee.packId) ?? 0) + 1);
      }
    }
  }
  return used;
}

async function loadVenues(classroomId: number): Promise<VenueInfo[]> {
  return prisma.venue.findMany({
    where: { classroomId },
    select: {
      id: true,
      locationId: true,
      perSessionPrice: true,
      packs: {
        where: { voidedAt: null },
        select: { id: true, sessions: true, price: true, remainingAtStart: true },
        orderBy: [{ purchasedAt: "asc" }, { id: "asc" }],
      },
    },
  });
}

/** 把規則裡的「場地費 → 場地」換成實際金額（每次付的價，或次數包先買先用的單價）。 */
function resolveLines(rule: SplitRule, venues: VenueInfo[], used: Map<number, number>) {
  let noPack = false;
  const lines: ResolvedLine[] = rule.lines.map((line) => {
    if (line.kind !== "venuePack") return line;
    const venue = venues.find((v) => v.id === line.venueId);
    if (venue?.perSessionPrice != null) {
      return { kind: "fixed", amount: venue.perSessionPrice, to: { type: "venue", venueId: line.venueId } };
    }
    const packs = venue?.packs ?? [];
    const pack =
      packs.find((p) => (used.get(p.id) ?? 0) < (p.remainingAtStart ?? p.sessions)) ?? packs[packs.length - 1];
    if (!pack) {
      noPack = true;
      return { kind: "fixed", amount: 0, to: { type: "venue", venueId: line.venueId } };
    }
    return {
      kind: "fixed",
      amount: roundCents(pack.price / pack.sessions),
      to: { type: "venue", venueId: line.venueId, packId: pack.id },
    };
  });
  return { lines, noPack };
}

function isCounted(p: LoadedPeriod) {
  const loc = p.lesson.location;
  return !!loc?.financeStartAt && p.startTime >= loc.financeStartAt && !!p.attendanceTakenAt;
}

function buildSnapshot(
  p: LoadedPeriod,
  venues: VenueInfo[],
  used: Map<number, number>,
  payerLocationId: number
): PeriodSnapshot {
  const warnings = new Set<PeriodWarning>();
  const lessonLoc = p.lesson.locationId;
  const fallbackLoc = lessonLoc ?? 0;
  if (!lessonLoc) warnings.add("NO_LOCATION");
  else if (!p.lesson.location?.financeStartAt || p.startTime < p.lesson.location.financeStartAt) warnings.add("NOT_STARTED");
  if (!p.attendanceTakenAt) warnings.add("NOT_TAKEN");
  if (lessonLoc && !p.lesson.location?.keeperUserId) warnings.add("NO_KEEPER");

  const records: PeriodRecord[] = p.attendanceRecords.map((r) => {
    const base = { studentId: r.student.id, studentName: r.student.name };
    if (r.dropInCharge) {
      if (!r.dropInCharge.isPaid) warnings.add("DROPIN_UNPAID");
      return {
        ...base,
        kind: "dropIn",
        studentCardId: null,
        serialNumber: null,
        amount: r.dropInCharge.amount,
        locationId: fallbackLoc,
        unpaid: !r.dropInCharge.isPaid,
      };
    }
    if (r.studentCard) {
      const c = r.studentCard;
      if (!c.isPaid) warnings.add("CARD_UNPAID");
      if (!c.moneyLocationId) warnings.add("CARD_NO_BRANCH");
      return {
        ...base,
        kind: "card",
        studentCardId: c.id,
        serialNumber: c.serialNumber,
        amount: roundCents(c.totalSessions > 0 ? (c.finalPrice / c.totalSessions) * r.sessionsUsed : 0),
        locationId: c.moneyLocationId ?? fallbackLoc,
        unpaid: !c.isPaid,
      };
    }
    warnings.add("NO_CARD");
    return { ...base, kind: "none", studentCardId: null, serialNumber: null, amount: 0, locationId: fallbackLoc, unpaid: false };
  });

  const pileMap = new Map<number, number>();
  for (const r of records) if (r.amount) pileMap.set(r.locationId, (pileMap.get(r.locationId) ?? 0) + r.amount);
  const piles = [...pileMap.entries()].map(([locationId, income]) => ({ locationId, income: roundCents(income) }));
  const income = roundCents(piles.reduce((s, x) => s + x.income, 0));

  const rawRule = p.splitOverride?.rule ?? p.lesson.splitRule?.rule ?? null;
  const ruleSource = p.splitOverride ? "override" : p.lesson.splitRule ? "lesson" : "none";
  if (!rawRule) warnings.add("NO_RULE");
  const rule = rawRule ? parseRule(rawRule) : EMPTY_RULE;

  const { lines, noPack } = resolveLines(rule, venues, used);
  if (noPack) warnings.add("NO_PACK");
  const allocations = computeSplit(income, lines, rule.rest).map((a) => ({ ...a, amount: roundCents(a.amount) }));

  const flowInput = {
    income,
    piles,
    allocations,
    lessonLocationId: fallbackLoc,
    payerLocationId,
    packLocationId: (packId: number) =>
      venues.find((v) => v.packs.some((pk) => pk.id === packId))?.locationId ?? null,
  };

  return {
    version: 1,
    income,
    piles,
    records,
    ruleSource,
    allocations,
    branchIncome: branchIncome(flowInput),
    flows: lessonLoc ? periodFlows(flowInput) : [],
    warnings: [...warnings],
  };
}

async function loadPeriod(classroomId: number, periodId: number) {
  const p = await prisma.lessonPeriod.findUnique({ where: { id: periodId }, include: periodInclude });
  if (!p || p.lesson.classroomId !== classroomId) throw notFound("Period");
  return p;
}

type KeptLocation = { id: number; keeperUserId: number | null; sortOrder: number };

const loadKept = (classroomId: number): Promise<KeptLocation[]> =>
  prisma.location.findMany({
    where: { classroomId, keeperUserId: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, keeperUserId: true, sortOrder: true },
  });

/** 付款人代表哪個分部：他負責開課分部就是開課分部，否則他負責的第一個分部。 */
function payerLocationOf(kept: KeptLocation[], userId: number, lessonLocationId: number | null) {
  const mine = kept.filter((l) => l.keeperUserId === userId);
  if (mine.length === 0) return null;
  return mine.find((l) => l.id === lessonLocationId)?.id ?? mine[0].id;
}

type Context = { venues: VenueInfo[]; used: Map<number, number>; kept: KeptLocation[] };

async function loadContext(classroomId: number, excludePeriodId?: number): Promise<Context> {
  const [venues, used, kept] = await Promise.all([
    loadVenues(classroomId),
    packUsage(classroomId, excludePeriodId),
    loadKept(classroomId),
  ]);
  return { venues, used, kept };
}

function toFinance(p: LoadedPeriod, ctx: Context): PeriodFinance {
  const keeper = p.lesson.location?.keeperUserId ?? null;
  const payerLocationId = p.settlement
    ? p.settlement.payerLocationId
    : (keeper && payerLocationOf(ctx.kept, keeper, p.lesson.locationId)) || p.lesson.locationId || 0;
  const live = buildSnapshot(p, ctx.venues, ctx.used, payerLocationId);

  const meta = {
    periodId: p.id,
    lessonId: p.lesson.id,
    lessonName: p.lesson.name,
    startTime: p.startTime,
    lessonLocationId: p.lesson.locationId,
    counted: isCounted(p),
    defaultPayerUserId: keeper,
  };

  if (!p.settlement) return { ...live, ...meta, settlement: null };

  const snap = p.settlement.snapshot as unknown as PeriodSnapshot;
  return {
    ...snap,
    ...meta,
    settlement: {
      paidByUserId: p.settlement.paidByUserId,
      payerLocationId: p.settlement.payerLocationId,
      settledAt: p.settlement.settledAt,
      changed:
        roundCents(live.income) !== roundCents(snap.income) || live.records.length !== snap.records.length,
    },
  };
}

export async function getPeriodFinance(classroomId: number, periodId: number): Promise<PeriodFinance> {
  const p = await loadPeriod(classroomId, periodId);
  return toFinance(p, await loadContext(classroomId, periodId));
}

/** 一門課所有時段的財務（課程頁用），一次載入。 */
export async function getLessonPeriodsFinance(classroomId: number, lessonId: number): Promise<PeriodFinance[]> {
  const periods = await prisma.lessonPeriod.findMany({
    where: { lessonId, lesson: { classroomId } },
    include: periodInclude,
    orderBy: { startTime: "asc" },
  });
  const ctx = await loadContext(classroomId);
  return periods.map((p) => toFinance(p, ctx));
}

/** 勾「已結清」：存下當下算好的快照。 */
export async function settlePeriod(
  classroomId: number,
  periodId: number,
  { actorUserId, paidByUserId }: { actorUserId: number; paidByUserId?: number | null }
) {
  const p = await loadPeriod(classroomId, periodId);
  if (p.settlement) throw new ApiError(409, "ALREADY_SETTLED", "Period already settled");
  if (!p.lesson.locationId) throw badRequest("NO_LOCATION", "Lesson has no branch");
  if (!p.attendanceTakenAt) throw badRequest("NOT_TAKEN", "Attendance not taken yet");
  if (!isCounted(p)) throw badRequest("NOT_STARTED", "Branch finance has not started for this period");

  const payer = paidByUserId ?? p.lesson.location?.keeperUserId ?? null;
  if (!payer) throw badRequest("NO_PAYER", "No payer and the branch has no keeper");
  const ctx = await loadContext(classroomId, periodId);
  const payerLocationId = payerLocationOf(ctx.kept, payer, p.lesson.locationId);
  if (!payerLocationId) throw badRequest("PAYER_NOT_KEEPER", "Payer must keep a branch");

  const snapshot = buildSnapshot(p, ctx.venues, ctx.used, payerLocationId);

  try {
    await prisma.periodSettlement.create({
      data: {
        lessonPeriodId: periodId,
        paidByUserId: payer,
        payerLocationId,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        createdById: actorUserId,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "ALREADY_SETTLED", "Period already settled");
    throw e;
  }
  return getPeriodFinance(classroomId, periodId);
}

export async function unsettlePeriod(classroomId: number, periodId: number) {
  await loadPeriod(classroomId, periodId);
  await prisma.periodSettlement.deleteMany({ where: { lessonPeriodId: periodId } });
  return getPeriodFinance(classroomId, periodId);
}
