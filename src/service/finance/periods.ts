import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { computeSplit } from "@/domains/finance/split";
import { cardUnitValue, periodIncome } from "@/domains/finance/income";
import type { IncomeSource, PendingNote } from "@/domains/finance/income";
import { splitRuleSchema } from "@/domains/finance/types";
import type { Allocation, ResolvedLine, SplitRule } from "@/domains/finance/types";
import { assertFinanceEnabled } from "./access";

export type PeriodFinanceWarning = "NO_PACK" | "PACK_OVERDRAWN";

export type PeriodFinance = {
  periodId: number;
  lessonId: number;
  lessonName: string;
  locationId: number | null;
  /** 這堂課的基金（規則的 fundLocationId；沒規則 → 上課分部）。分部報表依它歸類（spec「週日課」）。 */
  fundLocationId: number | null;
  startTime: Date;
  month: string; // 台北 YYYY-MM
  income: { total: number; realized: IncomeSource[]; pending: PendingNote[] };
  allocations: Allocation[] | null; // null = 沒有規則 → 未分配
  ruleSource: "override" | "lesson" | "none";
  warnings: PeriodFinanceWarning[];
};

export type PackUnitPrice = {
  venueId: number;
  packId: number;
  unit: number;
  overdrawn: boolean; // 超過所有包的總次數，照最後一包的單價扣
};

type RuleSource = PeriodFinance["ruleSource"];

/** 時段實際套用的規則：PeriodSplitOverride > LessonSplitRule > none。 */
export function effectiveRule(period: {
  splitOverride: { rule: Prisma.JsonValue } | null;
  lesson: { splitRule: { rule: Prisma.JsonValue } | null };
}): { rule: SplitRule | null; source: RuleSource } {
  if (period.splitOverride) {
    return { rule: splitRuleSchema.parse(period.splitOverride.rule), source: "override" };
  }
  if (period.lesson.splitRule) {
    return { rule: splitRuleSchema.parse(period.lesson.splitRule.rule), source: "lesson" };
  }
  return { rule: null, source: "none" };
}

/** 這堂課的基金：時段實際套用的規則的 fundLocationId；沒規則 → 上課分部。 */
export function periodFundLocationId(period: {
  splitOverride: { rule: Prisma.JsonValue } | null;
  lesson: { locationId: number | null; splitRule: { rule: Prisma.JsonValue } | null };
}): number | null {
  return effectiveRule(period).rule?.fundLocationId ?? period.lesson.locationId;
}

function venuePackIdOf(rule: SplitRule | null): number | null {
  const line = rule?.lines.find((l) => l.kind === "venuePack");
  return line && line.kind === "venuePack" ? line.venueId : null;
}

/** 財務上線後、已點名的時段（只有這些有分帳）。 */
function financePeriodWhere(classroomId: number, launch: Date): Prisma.LessonPeriodWhereInput {
  return {
    lesson: { classroomId },
    attendanceTakenAt: { not: null },
    startTime: { gte: launch },
  };
}

const ruleInclude = {
  splitOverride: { select: { rule: true } },
  lesson: { select: { splitRule: { select: { rule: true } } } },
} satisfies Prisma.LessonPeriodInclude;

/**
 * 次數包先買先用：每個場地的有效包依 purchasedAt 排，用到這個場地（venuePack 行）的
 * 已點名、上線後時段依 startTime 排，依序吃掉包的次數。超過所有包 → 最後一包的單價、
 * overdrawn。沒有任何包的場地，它的時段不在回傳的 Map 裡（呼叫端記 NO_PACK）。
 */
export async function resolvePackUnitPrices(classroomId: number): Promise<Map<number, PackUnitPrice>> {
  const result = new Map<number, PackUnitPrice>();
  const c = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { financeEnabledAt: true },
  });
  if (!c?.financeEnabledAt) return result;

  const periods = await prisma.lessonPeriod.findMany({
    where: financePeriodWhere(classroomId, c.financeEnabledAt),
    select: { id: true, ...ruleInclude },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
  const periodsByVenue = new Map<number, number[]>();
  for (const p of periods) {
    const venueId = venuePackIdOf(effectiveRule(p).rule);
    if (venueId === null) continue;
    const list = periodsByVenue.get(venueId) ?? [];
    list.push(p.id);
    periodsByVenue.set(venueId, list);
  }
  if (periodsByVenue.size === 0) return result;

  const packs = await prisma.venuePack.findMany({
    where: { classroomId, venueId: { in: [...periodsByVenue.keys()] }, voidedAt: null },
    select: { id: true, venueId: true, sessions: true, price: true },
    orderBy: [{ purchasedAt: "asc" }, { id: "asc" }],
  });

  for (const [venueId, periodIds] of periodsByVenue) {
    const venuePacks = packs.filter((p) => p.venueId === venueId);
    if (venuePacks.length === 0) continue;
    let packIndex = 0;
    let usedInPack = 0;
    for (const periodId of periodIds) {
      while (packIndex < venuePacks.length && usedInPack >= venuePacks[packIndex].sessions) {
        packIndex += 1;
        usedInPack = 0;
      }
      const overdrawn = packIndex >= venuePacks.length;
      const pack = overdrawn ? venuePacks[venuePacks.length - 1] : venuePacks[packIndex];
      if (!overdrawn) usedInPack += 1;
      result.set(periodId, {
        venueId,
        packId: pack.id,
        unit: pack.price / pack.sessions,
        overdrawn,
      });
    }
  }
  return result;
}

const cardSelect = {
  finalPrice: true,
  totalSessions: true,
  isPaid: true,
  paidByUserId: true,
} satisfies Prisma.StudentCardSelect;

/**
 * 每個已點名時段的財務（收入＋分帳）。只取 attendanceTakenAt != null 且
 * startTime >= financeEnabledAt 的時段；`to` 不含（startTime < to）。
 */
export async function loadPeriodFinance(
  classroomId: number,
  where: { from?: Date; to?: Date; lessonId?: number; periodIds?: number[] },
): Promise<PeriodFinance[]> {
  const { financeEnabledAt, legacyCustodianUserId } = await assertFinanceEnabled(classroomId);

  const periods = await prisma.lessonPeriod.findMany({
    where: {
      AND: [
        financePeriodWhere(classroomId, financeEnabledAt),
        where.from || where.to
          ? { startTime: { ...(where.from ? { gte: where.from } : {}), ...(where.to ? { lt: where.to } : {}) } }
          : {},
        where.lessonId !== undefined ? { lessonId: where.lessonId } : {},
        where.periodIds !== undefined ? { id: { in: where.periodIds } } : {},
      ],
    },
    select: {
      id: true,
      startTime: true,
      splitOverride: { select: { rule: true } },
      lesson: {
        select: { id: true, name: true, locationId: true, splitRule: { select: { rule: true } } },
      },
      attendanceRecords: {
        select: {
          id: true,
          studentId: true,
          sessionsUsed: true,
          studentCard: { select: cardSelect },
          dropInCharge: { select: { id: true, amount: true, isPaid: true, paidByUserId: true } },
        },
        orderBy: { id: "asc" },
      },
      absences: {
        select: { id: true, studentId: true, sessionsUsed: true, studentCard: { select: cardSelect } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  const holderOf = (paid: boolean, paidByUserId: number | null) =>
    paid ? (paidByUserId ?? legacyCustodianUserId) : null;

  const resolved = periods.map((p) => ({ period: p, ...effectiveRule(p) }));
  const packPrices = resolved.some((r) => venuePackIdOf(r.rule) !== null)
    ? await resolvePackUnitPrices(classroomId)
    : new Map<number, PackUnitPrice>();

  return resolved.map(({ period, rule, source }) => {
    const sources: IncomeSource[] = [];
    const undecided: number[] = [];
    for (const r of period.attendanceRecords) {
      if (r.dropInCharge) {
        const d = r.dropInCharge;
        sources.push({
          kind: "dropIn",
          refId: d.id,
          studentId: r.studentId,
          amount: d.amount,
          paid: d.isPaid,
          holderUserId: holderOf(d.isPaid, d.paidByUserId),
        });
      } else if (r.studentCard) {
        const sc = r.studentCard;
        sources.push({
          kind: "card",
          refId: r.id,
          studentId: r.studentId,
          amount: cardUnitValue(sc) * r.sessionsUsed,
          paid: sc.isPaid,
          holderUserId: holderOf(sc.isPaid, sc.paidByUserId),
        });
      } else {
        undecided.push(r.studentId);
      }
    }
    for (const a of period.absences) {
      const sc = a.studentCard;
      sources.push({
        kind: "absence",
        refId: a.id,
        studentId: a.studentId,
        amount: cardUnitValue(sc) * a.sessionsUsed,
        paid: sc.isPaid,
        holderUserId: holderOf(sc.isPaid, sc.paidByUserId),
      });
    }
    const income = periodIncome(sources, undecided);

    const warnings: PeriodFinanceWarning[] = [];
    let allocations: Allocation[] | null = null;
    if (rule) {
      const lines: ResolvedLine[] = rule.lines.map((line) => {
        if (line.kind !== "venuePack") return line;
        const pack = packPrices.get(period.id);
        if (!pack || pack.venueId !== line.venueId) {
          warnings.push("NO_PACK");
          return { kind: "fixed", amount: 0, to: { type: "venue", venueId: line.venueId } };
        }
        if (pack.overdrawn) warnings.push("PACK_OVERDRAWN");
        return {
          kind: "fixed",
          amount: pack.unit,
          to: { type: "venue", venueId: line.venueId, packId: pack.packId },
        };
      });
      allocations = computeSplit(income.total, lines, rule.rest, rule.fundLocationId);
    }

    return {
      periodId: period.id,
      lessonId: period.lesson.id,
      lessonName: period.lesson.name,
      locationId: period.lesson.locationId,
      fundLocationId: rule?.fundLocationId ?? period.lesson.locationId,
      startTime: period.startTime,
      month: toTaipeiMonthKey(period.startTime),
      income: { total: income.total, realized: income.realized, pending: income.pending },
      allocations,
      ruleSource: source,
      warnings,
    };
  });
}
