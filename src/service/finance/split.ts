import type { FinanceSplitRule, FinanceSplitShare, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { badRequest } from "@/lib/apiError";
import { parseTaipeiDateRange, parseTaipeiMonthRange, toTaipeiDateKey, toTaipeiMonthKey } from "@/lib/taipei-date";
import {
  allocateFees,
  resolveRule,
  splitPeriod,
  type PeriodInput,
  type RuleLayer,
  type SplitFlag,
  type SplitResult,
} from "@/domains/finance/split";
import type { SplitRuleInput } from "@/domains/finance/schemas";

/**
 * 第二步：分帳規則、每堂分帳、驗收（docs/finance-db.md §4）。
 * 驗收前全部即時算；驗收那一刻存一份（FinanceLessonSettlement），之後重算跟存的
 * 輸入不一樣＝點名改過，退回待驗收。算法本身在 src/domains/finance/split.ts。
 */

type RuleRow = FinanceSplitRule & { shares: FinanceSplitShare[] };

const toLayer = (row: RuleRow): RuleLayer => ({
  ...row,
  shares: row.shares.map(({ teacherId, pct }) => ({ teacherId, pct })),
});

/** 某一層在某個時間點有效的那一列：effectiveFrom ≤ at 的最新一列。 */
function effectiveAt(rows: RuleRow[], at: Date): RuleRow | null {
  let best: RuleRow | null = null;
  for (const row of rows) {
    if (row.effectiveFrom > at) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }
  return best;
}

async function loadRules(classroomId: number) {
  const rows = await prisma.financeSplitRule.findMany({
    where: { classroomId },
    include: { shares: true },
    orderBy: { effectiveFrom: "asc" },
  });
  const classroom = rows.filter((r) => r.scope === "CLASSROOM");
  const byLocation = new Map<number, RuleRow[]>();
  const byLesson = new Map<number, RuleRow[]>();
  for (const row of rows) {
    if (row.scope === "LOCATION" && row.locationId) byLocation.set(row.locationId, [...(byLocation.get(row.locationId) ?? []), row]);
    if (row.scope === "LESSON" && row.lessonId) byLesson.set(row.lessonId, [...(byLesson.get(row.lessonId) ?? []), row]);
  }
  return {
    hasLocationRules: byLocation.size > 0,
    at(lessonId: number, locationId: number | null, when: Date) {
      const pick = (list: RuleRow[] | undefined) => {
        const row = list ? effectiveAt(list, when) : null;
        return row ? toLayer(row) : null;
      };
      return resolveRule({
        classroom: pick(classroom),
        location: locationId ? pick(byLocation.get(locationId)) : null,
        lesson: pick(byLesson.get(lessonId)),
      });
    },
  };
}

/** 沒卡的人用這門課（非體驗卡）最便宜的每堂價暫估。 */
function estimatedPrice(cards: { card: { price: number; sessions: number; isTrial: boolean } }[]) {
  const prices = cards
    .filter(({ card }) => !card.isTrial && card.sessions > 0)
    .map(({ card }) => Math.round(card.price / card.sessions));
  return prices.length > 0 ? Math.min(...prices) : 0;
}

const periodInclude = {
  lesson: {
    select: {
      id: true,
      name: true,
      locationId: true,
      teachers: { select: { teacherId: true } },
      cards: { select: { card: { select: { price: true, sessions: true, isTrial: true } } } },
    },
  },
  attendanceRecords: { select: { studentCard: { select: { finalPrice: true, totalSessions: true } } } },
  assistants: { select: { teacherId: true } },
  financeSettlement: {
    include: {
      lines: { select: { kind: true, teacherId: true, amount: true } },
      verifiedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.LessonPeriodInclude;

export type LessonSplitStatus = "UPCOMING" | "NOT_TAKEN" | "PENDING" | "CHANGED" | "VERIFIED";

export type LessonSplitRow = {
  periodId: number;
  lessonId: number;
  lessonName: string;
  startTime: Date;
  dateKey: string;
  locationId: number | null;
  attendeeCount: number;
  status: LessonSplitStatus;
  flags: (SplitFlag | "NO_LOCATION")[];
  /** 現在算出來的（還沒點名的是 null）。 */
  split: SplitResult | null;
  /** 存過的驗收；CHANGED 時 revenueDiff ＝ 現在 − 驗收時。 */
  verified: { by: { id: number; name: string }; at: Date; revenue: number; revenueDiff: number } | null;
};

/** from、to 是台北日期（含頭含尾）。一定整天整天算，每天固定的費用才平攤得對。 */
export async function getLessonSplits(classroomId: number, from: string, to: string, now = new Date()) {
  return (await computeLessonSplits(classroomId, from, to, now)).rows;
}

type SettlementMeta = { inputsKey: string; ruleIds: number[] };

async function computeLessonSplits(classroomId: number, from: string, to: string, now: Date) {
  const start = parseTaipeiDateRange(from).start;
  const end = parseTaipeiDateRange(to).end;

  const [periods, rules, setting] = await Promise.all([
    prisma.lessonPeriod.findMany({
      where: { startTime: { gte: start, lt: end }, lesson: { classroomId } },
      include: periodInclude,
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
    loadRules(classroomId),
    prisma.financeSetting.findUnique({ where: { classroomId }, select: { revenueOwnerUserId: true } }),
  ]);
  const owner = setting?.revenueOwnerUserId
    ? await prisma.teacher.findFirst({
        where: { classroomId, userId: setting.revenueOwnerUserId },
        select: { id: true },
      })
    : null;

  const inputs = new Map<number, PeriodInput>();
  for (const p of periods) {
    if (!p.attendanceTakenAt) continue;
    const perHead = estimatedPrice(p.lesson.cards);
    let cardRevenue = 0;
    let estimated = 0;
    for (const record of p.attendanceRecords) {
      if (record.studentCard) cardRevenue += record.studentCard.finalPrice / record.studentCard.totalSessions;
      else estimated += perHead;
    }
    inputs.set(p.id, {
      periodId: p.id,
      startTime: p.startTime,
      dateKey: toTaipeiDateKey(p.startTime),
      locationId: p.lesson.locationId,
      revenue: Math.round(cardRevenue) + estimated,
      estimated,
      teacherIds: p.lesson.teachers.map((t) => t.teacherId).sort((a, b) => a - b),
      assistantIds: p.assistants.map((a) => a.teacherId).sort((a, b) => a - b),
      rule: rules.at(p.lesson.id, p.lesson.locationId, p.startTime),
    });
  }
  const fees = allocateFees([...inputs.values()]);
  const meta = new Map<number, SettlementMeta>();

  const rows = periods.map((p): LessonSplitRow => {
    const input = inputs.get(p.id);
    const base = {
      periodId: p.id,
      lessonId: p.lesson.id,
      lessonName: p.lesson.name,
      startTime: p.startTime,
      dateKey: toTaipeiDateKey(p.startTime),
      locationId: p.lesson.locationId,
      attendeeCount: p.attendanceRecords.length,
    };
    if (!input) {
      return { ...base, status: p.startTime > now ? "UPCOMING" : "NOT_TAKEN", flags: [], split: null, verified: null };
    }
    const split = splitPeriod(input, fees.get(p.id)!, { revenueOwnerTeacherId: owner?.id ?? null });
    const flags: LessonSplitRow["flags"] = [...split.flags];
    if (p.lesson.locationId === null && rules.hasLocationRules) flags.push("NO_LOCATION");

    const key = inputsKey(input, split);
    meta.set(p.id, { inputsKey: key, ruleIds: input.rule.ruleIds });
    const settlement = p.financeSettlement;
    const status: LessonSplitStatus = !settlement ? "PENDING" : settlement.inputsKey === key ? "VERIFIED" : "CHANGED";
    return {
      ...base,
      status,
      flags,
      split,
      verified: settlement
        ? {
            by: settlement.verifiedBy,
            at: settlement.verifiedAt,
            revenue: settlement.revenue,
            revenueDiff: split.revenue - settlement.revenue,
          }
        : null,
    };
  });
  return { rows, meta };
}

/** 算這堂用到的輸入。重算後不一樣＝點名（或同一天別堂、規則）改過，要重新驗收。 */
function inputsKey(input: PeriodInput, split: SplitResult) {
  return JSON.stringify([
    input.revenue,
    input.estimated,
    input.teacherIds,
    input.assistantIds,
    input.rule.ruleIds,
    split.venueFee,
    split.assistantFee,
  ]);
}

function settlementLines(split: SplitResult) {
  const lines: { kind: "TEACHER" | "VENUE" | "ASSISTANT" | "REMAINDER"; teacherId: number | null; amount: number }[] = [
    ...split.teacherLines.map((l) => ({ kind: "TEACHER" as const, teacherId: l.teacherId, amount: l.amount })),
    ...split.assistantLines.map((l) => ({ kind: "ASSISTANT" as const, teacherId: l.teacherId, amount: l.amount })),
  ];
  if (split.venueFee > 0) lines.push({ kind: "VENUE", teacherId: split.venueTeacherId, amount: split.venueFee });
  if (split.remainderTeacherId !== null && split.remainder > 0) {
    lines.push({ kind: "REMAINDER", teacherId: split.remainderTeacherId, amount: split.remainder });
  }
  return lines;
}

/**
 * 驗收。整批（batch）只收沒有任何提醒的；一堂一堂按的話，沒卡（照暫估）也可以。
 * 手動結算的課還不支援。驗收過、點名又被改的，重新驗收會留一筆修改紀錄。
 */
export async function verifyLessons(input: {
  classroomId: number;
  userId: number;
  periodIds: number[];
  batch: boolean;
  now?: Date;
}) {
  const targets = await prisma.lessonPeriod.findMany({
    where: { id: { in: input.periodIds }, lesson: { classroomId: input.classroomId } },
    select: { id: true, startTime: true },
  });
  if (targets.length === 0) return { verified: [], skipped: input.periodIds.map((periodId) => ({ periodId, reason: "NOT_FOUND" })) };

  const keys = targets.map((t) => toTaipeiDateKey(t.startTime)).sort();
  const { rows, meta } = await computeLessonSplits(
    input.classroomId,
    keys[0],
    keys[keys.length - 1],
    input.now ?? new Date()
  );
  const wanted = new Set(targets.map((t) => t.id));
  const verified: number[] = [];
  const skipped: { periodId: number; reason: string }[] = input.periodIds
    .filter((id) => !wanted.has(id))
    .map((periodId) => ({ periodId, reason: "NOT_FOUND" }));

  for (const row of rows) {
    if (!wanted.has(row.periodId)) continue;
    const reason =
      !row.split ? "NOT_TAKEN"
      : row.status === "VERIFIED" ? "ALREADY_VERIFIED"
      : row.flags.includes("MANUAL") ? "MANUAL"
      : input.batch && row.flags.length > 0 ? "NEEDS_REVIEW"
      : null;
    if (reason) {
      skipped.push({ periodId: row.periodId, reason });
      continue;
    }
    await saveSettlement(input.classroomId, input.userId, row, meta.get(row.periodId)!, input.now ?? new Date());
    verified.push(row.periodId);
  }
  return { verified, skipped };
}

async function saveSettlement(
  classroomId: number,
  userId: number,
  row: LessonSplitRow,
  meta: SettlementMeta,
  at: Date
) {
  const split = row.split!;
  const data = {
    inputsKey: meta.inputsKey,
    ruleIds: meta.ruleIds,
    revenue: split.revenue,
    estimated: split.estimated,
    attendeeCount: row.attendeeCount,
    venueFee: split.venueFee,
    assistantFee: split.assistantFee,
    commission: split.commission,
    remainder: split.remainder,
    fund: split.fund,
    verifiedById: userId,
    verifiedAt: at,
  };
  const lines = settlementLines(split);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.financeLessonSettlement.findUnique({
      where: { lessonPeriodId: row.periodId },
      include: { lines: { select: { kind: true, teacherId: true, amount: true } } },
    });
    if (!existing) {
      await tx.financeLessonSettlement.create({
        data: { ...data, classroomId, lessonPeriodId: row.periodId, lines: { create: lines } },
      });
      return;
    }
    await tx.financeSettlementLine.deleteMany({ where: { settlementId: existing.id } });
    await tx.financeLessonSettlement.update({
      where: { id: existing.id },
      data: { ...data, overridden: false, overrideReason: null, lines: { create: lines } },
    });
    await tx.financeSettlementRevision.create({
      data: {
        settlementId: existing.id,
        editedById: userId,
        reason: "點名改過，重新驗收",
        before: { revenue: existing.revenue, attendeeCount: existing.attendeeCount, lines: existing.lines },
        after: { revenue: data.revenue, attendeeCount: data.attendeeCount, lines },
      },
    });
  });
}

// ---------- 規則

const EPOCH = new Date(0);

function monthStart(date: Date) {
  return parseTaipeiMonthRange(toTaipeiMonthKey(date)).start;
}
function nextMonthStart(date: Date) {
  const [y, m] = toTaipeiMonthKey(date).split("-").map(Number);
  return parseTaipeiMonthRange(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`).start;
}

export async function getSplitRules(classroomId: number) {
  return prisma.financeSplitRule.findMany({
    where: { classroomId },
    include: { shares: { select: { teacherId: true, pct: true } } },
    orderBy: [{ scope: "asc" }, { effectiveFrom: "desc" }, { id: "desc" }],
  });
}

/**
 * 存一層規則。某一層（全教室、某個分部、某門課）第一次設＝從頭開始算；之後改的預設
 * 從下個月 1 號生效（applyFrom = THIS_MONTH 可以從這個月 1 號，驗收過的課會變成
 * 「改過」要重新驗收）。同一層同一天生效的已經有一列就直接改它。
 */
export async function saveSplitRule(classroomId: number, userId: number, input: SplitRuleInput, now = new Date()) {
  const target = {
    scope: input.scope,
    locationId: input.scope === "LOCATION" ? input.locationId ?? null : null,
    lessonId: input.scope === "LESSON" ? input.lessonId ?? null : null,
  };
  if (target.scope === "LOCATION" && !target.locationId) throw badRequest("LOCATION_REQUIRED");
  if (target.scope === "LESSON" && !target.lessonId) throw badRequest("LESSON_REQUIRED");
  if (target.locationId && !(await prisma.location.findFirst({ where: { id: target.locationId, classroomId } }))) {
    throw badRequest("LOCATION_NOT_FOUND");
  }
  if (target.lessonId && !(await prisma.lesson.findFirst({ where: { id: target.lessonId, classroomId } }))) {
    throw badRequest("LESSON_NOT_FOUND");
  }
  const teacherIds = [
    ...(input.venueTeacherId ? [input.venueTeacherId] : []),
    ...(input.shares ?? []).map((s) => s.teacherId),
  ];
  if (teacherIds.length > 0) {
    const unique = [...new Set(teacherIds)];
    const count = await prisma.teacher.count({ where: { id: { in: unique }, classroomId } });
    if (count !== unique.length) throw badRequest("TEACHER_NOT_FOUND");
  }
  if (input.shares && input.shares.length > 0 && input.shares.reduce((sum, s) => sum + s.pct, 0) !== 100) {
    throw badRequest("SHARES_NOT_100", "比例加起來要是 100%");
  }

  const isFirst = (await prisma.financeSplitRule.count({ where: { classroomId, ...target } })) === 0;
  const effectiveFrom =
    input.applyFrom === "THIS_MONTH" ? monthStart(now)
    : input.applyFrom === "NEXT_MONTH" ? nextMonthStart(now)
    : isFirst ? EPOCH
    : nextMonthStart(now);

  const knobs = {
    teacherPay: input.teacherPay ?? null,
    hourlyFee: input.hourlyFee ?? null,
    venueMode: input.venueMode ?? null,
    venueAmount: input.venueAmount ?? null,
    venuePayee: input.venuePayee ?? null,
    venueTeacherId: input.venueTeacherId ?? null,
    assistantMode: input.assistantMode ?? null,
    assistantAmount: input.assistantAmount ?? null,
    commissionPct: input.commissionPct ?? null,
    manual: target.scope === "LESSON" ? input.manual ?? null : null,
    roundTo: target.scope === "CLASSROOM" ? input.roundTo ?? null : null,
    remainderTo: target.scope === "CLASSROOM" ? input.remainderTo ?? null : null,
    reason: input.reason ?? null,
  };
  const shares = target.scope === "LESSON" ? input.shares ?? [] : [];

  return prisma.$transaction(async (tx) => {
    const existing = await tx.financeSplitRule.findFirst({
      where: { classroomId, ...target, effectiveFrom },
      select: { id: true },
    });
    const rule = existing
      ? await tx.financeSplitRule.update({ where: { id: existing.id }, data: knobs })
      : await tx.financeSplitRule.create({ data: { classroomId, ...target, effectiveFrom, createdById: userId, ...knobs } });
    await tx.financeSplitShare.deleteMany({ where: { ruleId: rule.id } });
    if (shares.length > 0) {
      await tx.financeSplitShare.createMany({ data: shares.map((s) => ({ ruleId: rule.id, teacherId: s.teacherId, pct: s.pct })) });
    }
    return tx.financeSplitRule.findUniqueOrThrow({
      where: { id: rule.id },
      include: { shares: { select: { teacherId: true, pct: true } } },
    });
  });
}
