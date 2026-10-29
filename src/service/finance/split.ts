import type { FinanceSplitRule, FinanceSplitShare, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/apiError";
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
import { getVaultLedger } from "./money";
import { ENTRY_CATEGORIES, isEntryCategory, signedEntryAmount } from "@/domains/finance/money";

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
  /** 課程設了比例、這堂卻沒掛到的老師（MISSING_SHARE_TEACHER）。 */
  missingShareTeacherIds: number[];
  /** 現在算出來的（還沒點名的是 null）。 */
  split: SplitResult | null;
  /** 存過的驗收；CHANGED 時 revenueDiff ＝ 現在 − 驗收時。 */
  verified: {
    by: { id: number; name: string };
    at: Date;
    revenue: number;
    revenueDiff: number;
    /** 驗收時存下的分法（手動改過的也在這裡）。 */
    lines: SettlementLine[];
    fund: number;
    overridden: boolean;
    overrideReason: string | null;
  } | null;
};

type SettlementLine = { kind: "TEACHER" | "VENUE" | "ASSISTANT" | "REMAINDER"; teacherId: number | null; amount: number };

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
      return { ...base, status: p.startTime > now ? "UPCOMING" : "NOT_TAKEN", flags: [], missingShareTeacherIds: [], split: null, verified: null };
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
      missingShareTeacherIds: input.rule.shares
        .filter((share) => !input.teacherIds.includes(share.teacherId))
        .map((share) => share.teacherId),
      split,
      verified: settlement
        ? {
            by: settlement.verifiedBy,
            at: settlement.verifiedAt,
            revenue: settlement.revenue,
            revenueDiff: split.revenue - settlement.revenue,
            lines: settlement.lines,
            fund: settlement.fund,
            overridden: settlement.overridden,
            overrideReason: settlement.overrideReason,
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
  const lines: SettlementLine[] = [
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
  at: Date,
  override?: { teacherLines: { teacherId: number; amount: number }[]; reason: string }
) {
  const split = row.split!;
  const lines: SettlementLine[] = override
    ? [
        ...override.teacherLines.map((l) => ({ kind: "TEACHER" as const, ...l })),
        ...settlementLines(split).filter((l) => l.kind === "VENUE" || l.kind === "ASSISTANT"),
      ]
    : settlementLines(split);
  const paid = lines.filter((l) => l.kind !== "VENUE" || l.teacherId !== null).reduce((sum, l) => sum + l.amount, 0);
  const externalVenue = lines.filter((l) => l.kind === "VENUE" && l.teacherId === null).reduce((sum, l) => sum + l.amount, 0);
  const data = {
    inputsKey: meta.inputsKey,
    ruleIds: meta.ruleIds,
    revenue: split.revenue,
    estimated: split.estimated,
    attendeeCount: row.attendeeCount,
    venueFee: split.venueFee,
    assistantFee: split.assistantFee,
    commission: split.commission,
    remainder: override ? 0 : split.remainder,
    fund: split.revenue - paid - externalVenue,
    overridden: Boolean(override),
    overrideReason: override?.reason ?? null,
    verifiedById: userId,
    verifiedAt: at,
  };

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
      data: { ...data, lines: { create: lines } },
    });
    await tx.financeSettlementRevision.create({
      data: {
        settlementId: existing.id,
        editedById: userId,
        reason: override?.reason ?? "重新驗收",
        before: { revenue: existing.revenue, attendeeCount: existing.attendeeCount, lines: existing.lines },
        after: { revenue: data.revenue, attendeeCount: data.attendeeCount, lines },
      },
    });
  });
}

/**
 * 驗收時手動改老師實拿（例如這堂少掛了一位老師）。場地費、助教費照算，
 * 改過的差額由水庫基金吸收；不再算零頭。要寫原因，之後看得到原本的數字。
 */
export async function overrideLesson(input: {
  classroomId: number;
  userId: number;
  periodId: number;
  teacherLines: { teacherId: number; amount: number }[];
  reason: string;
  now?: Date;
}) {
  const period = await prisma.lessonPeriod.findFirst({
    where: { id: input.periodId, lesson: { classroomId: input.classroomId } },
    select: { startTime: true },
  });
  if (!period) throw notFound("Lesson period");
  const ids = [...new Set(input.teacherLines.map((l) => l.teacherId))];
  if (ids.length !== input.teacherLines.length) throw badRequest("DUPLICATE_TEACHER");
  if (ids.length > 0 && (await prisma.teacher.count({ where: { id: { in: ids }, classroomId: input.classroomId } })) !== ids.length) {
    throw badRequest("TEACHER_NOT_FOUND");
  }

  const day = toTaipeiDateKey(period.startTime);
  const { rows, meta } = await computeLessonSplits(input.classroomId, day, day, input.now ?? new Date());
  const row = rows.find((r) => r.periodId === input.periodId)!;
  if (!row.split) throw badRequest("NOT_TAKEN", "這堂還沒點名");
  if (row.flags.includes("MANUAL")) throw badRequest("MANUAL", "手動結算的課還不支援");
  await saveSettlement(input.classroomId, input.userId, row, meta.get(row.periodId)!, input.now ?? new Date(), {
    teacherLines: input.teacherLines,
    reason: input.reason,
  });
  return { verified: [input.periodId] };
}

/** 這堂實際的分法：驗收過（而且沒被改）用存下的，其他用現在算的。 */
function effective(row: LessonSplitRow) {
  if (!row.split) return null;
  if (row.status === "VERIFIED" && row.verified) {
    return { lines: row.verified.lines, revenue: row.verified.revenue, fund: row.verified.fund };
  }
  return { lines: settlementLines(row.split), revenue: row.split.revenue, fund: row.split.fund };
}

const LINE_KEY = { TEACHER: "teach", VENUE: "venue", ASSISTANT: "assistant", REMAINDER: "remainder" } as const;

/** 一批堂分給誰多少：驗收過的用存下的分法，其他用現在算的。 */
export function distribution(rows: LessonSplitRow[]) {
  const people = new Map<number, { teacherId: number; teach: number; venue: number; assistant: number; remainder: number; total: number }>();
  let fund = 0;
  let externalVenue = 0;
  let revenue = 0;
  for (const row of rows) {
    const e = effective(row);
    if (!e) continue;
    revenue += e.revenue;
    fund += e.fund;
    for (const line of e.lines) {
      if (line.teacherId === null) {
        externalVenue += line.amount;
        continue;
      }
      const p = people.get(line.teacherId) ?? { teacherId: line.teacherId, teach: 0, venue: 0, assistant: 0, remainder: 0, total: 0 };
      p[LINE_KEY[line.kind]] += line.amount;
      p.total += line.amount;
      people.set(line.teacherId, p);
    }
  }
  return { revenue, fund, externalVenue, people: [...people.values()].sort((a, b) => b.total - a.total) };
}

// ---------- 老師薪水（月中累積）

type Amounts = { teach: number; venue: number; assistant: number; remainder: number; total: number };
const zero = (): Amounts => ({ teach: 0, venue: 0, assistant: 0, remainder: 0, total: 0 });

/**
 * 每位老師這個月到現在累積多少：每堂點完名就算進去（還沒驗收的照現在算的），
 * 月結時才凍結成薪資單。canSeeAll ＝ 能改水庫的人看全部；其他人只看自己的老師資料。
 */
export async function getTeacherMonth(
  classroomId: number,
  monthKey: string,
  viewer: { userId: number; canSeeAll: boolean },
  now = new Date()
) {
  const { start, end } = parseTaipeiMonthRange(monthKey);
  const [rows, teachers] = await Promise.all([
    getLessonSplits(classroomId, toTaipeiDateKey(start), toTaipeiDateKey(new Date(end.getTime() - 1)), now),
    prisma.teacher.findMany({
      where: { classroomId },
      select: { id: true, name: true, color: true, kind: true, userId: true },
    }),
  ]);

  type Item = Amounts & { periodId: number; dateKey: string; startTime: Date; lessonName: string; status: LessonSplitStatus };
  const people = new Map<number, Amounts & { items: Item[]; missing: { periodId: number; dateKey: string; lessonName: string }[] }>();
  const person = (teacherId: number) => {
    if (!people.has(teacherId)) people.set(teacherId, { ...zero(), items: [], missing: [] });
    return people.get(teacherId)!;
  };

  for (const row of rows) {
    const e = effective(row);
    if (!e) continue;
    const items = new Map<number, Item>();
    for (const line of e.lines) {
      if (line.teacherId === null) continue;
      const item = items.get(line.teacherId) ?? {
        ...zero(),
        periodId: row.periodId,
        dateKey: row.dateKey,
        startTime: row.startTime,
        lessonName: row.lessonName,
        status: row.status,
      };
      item[LINE_KEY[line.kind]] += line.amount;
      item.total += line.amount;
      items.set(line.teacherId, item);
    }
    for (const [teacherId, item] of items) {
      const p = person(teacherId);
      p.items.push(item);
      for (const key of ["teach", "venue", "assistant", "remainder", "total"] as const) p[key] += item[key];
    }
    if (row.status !== "VERIFIED") {
      for (const teacherId of row.missingShareTeacherIds) {
        person(teacherId).missing.push({ periodId: row.periodId, dateKey: row.dateKey, lessonName: row.lessonName });
      }
    }
  }

  const byId = new Map(teachers.map((t) => [t.id, t]));
  return {
    month: monthKey,
    people: [...people.entries()]
      .map(([teacherId, p]) => {
        const t = byId.get(teacherId)!;
        return {
          teacher: { id: t.id, name: t.name, color: t.color, kind: t.kind, hasAccount: t.userId !== null },
          ...p,
          lessonCount: p.items.filter((i) => i.teach > 0).length,
          pendingCount: p.items.filter((i) => i.status !== "VERIFIED").length,
        };
      })
      .filter((p) => viewer.canSeeAll || byId.get(p.teacher.id)?.userId === viewer.userId)
      .sort((a, b) => b.total - a.total),
  };
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

// ---------- 當天的帳

type DayVaultRow = {
  kind: "entry" | "card" | "remittance";
  label: string;
  category: string | null;
  amount: number;
  by: string | null;
  voided: boolean;
};

/**
 * 一天一頁：這天每堂的分帳、分給誰多少，以及這天真的收付的錢
 * （大水庫的進出＋結餘、收款人自己收的課卡錢）。
 */
export async function getDayBook(classroomId: number, dateKey: string, now = new Date()) {
  const { start, end } = parseTaipeiDateRange(dateKey);
  const [rows, ledger, setting] = await Promise.all([
    getLessonSplits(classroomId, dateKey, dateKey, now),
    getVaultLedger(classroomId),
    prisma.financeSetting.findUnique({ where: { classroomId }, select: { revenueOwnerUserId: true } }),
  ]);

  // ledger.entries 是新到舊、每列帶當下的結餘
  const vaultRows = ledger.entries.filter((e) => e.kind !== "opening" && e.at >= start && e.at < end);
  const balance = ledger.entries.find((e) => e.at < end)?.balance ?? null;

  const custody = await prisma.studentCard.findMany({
    where: {
      student: { classroomId },
      isPaid: true,
      origin: "PURCHASE",
      finalPrice: { gt: 0 },
      paidAt: { gte: start, lt: end },
      NOT: { paidByUserId: setting?.revenueOwnerUserId ?? -1 },
    },
    select: {
      id: true,
      finalPrice: true,
      student: { select: { name: true } },
      card: { select: { name: true } },
      paidBy: { select: { id: true, name: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  return {
    date: dateKey,
    lessons: rows,
    distribution: distribution(rows),
    vault: {
      rows: vaultRows.reverse().flatMap((e): DayVaultRow[] => {
        switch (e.kind) {
          case "entry":
            return [{ kind: e.kind, label: e.description || e.category, category: e.category, amount: e.voidedAt ? 0 : e.signed, by: e.createdBy.name, voided: Boolean(e.voidedAt) }];
          case "card":
            return [{ kind: e.kind, label: `${e.studentName} · ${e.cardName}`, category: null, amount: e.amount, by: null, voided: false }];
          case "remittance":
            return [{ kind: e.kind, label: `${e.from.name} 送回`, category: null, amount: e.amount, by: null, voided: false }];
          default:
            return [];
        }
      }),
      balance,
    },
    custody: custody.map((c) => ({
      studentCardId: c.id,
      label: `${c.student.name} · ${c.card.name}`,
      amount: c.finalPrice,
      holder: c.paidBy,
    })),
  };
}

// ---------- 行事曆

export type CalendarDayStatus = "PENDING" | "NOT_TAKEN" | "VERIFIED" | "UPCOMING";

/**
 * 一個月的行事曆：每天的課一個狀態（還有一堂沒驗收就是待驗收），加上那天的錢的事
 * （大水庫的帳、繳回、發薪日）。格子裡不寫堂數，點進去是當天的帳。
 */
export async function getFinanceCalendar(classroomId: number, monthKey: string, now = new Date()) {
  const { start, end } = parseTaipeiMonthRange(monthKey);
  const [rows, entries, remittances, setting] = await Promise.all([
    getLessonSplits(classroomId, toTaipeiDateKey(start), toTaipeiDateKey(new Date(end.getTime() - 1)), now),
    prisma.financeEntry.findMany({
      where: { classroomId, voidedAt: null, date: { gte: start, lt: end } },
      select: { date: true, category: true, amount: true, description: true },
      orderBy: { date: "asc" },
    }),
    prisma.financeRemittance.findMany({
      where: { classroomId, status: { in: ["PENDING", "CONFIRMED"] }, sentOn: { gte: start, lt: end } },
      select: { sentOn: true, amount: true, status: true, fromUser: { select: { name: true } } },
      orderBy: { sentOn: "asc" },
    }),
    prisma.financeSetting.findUnique({ where: { classroomId }, select: { payday: true } }),
  ]);

  type Day = {
    dateKey: string;
    status: CalendarDayStatus | null;
    needsLook: boolean;
    money: { kind: "entry" | "remittance" | "payday"; label: string; amount: number | null }[];
  };
  const days = new Map<string, Day>();
  const day = (dateKey: string) => {
    if (!days.has(dateKey)) days.set(dateKey, { dateKey, status: null, needsLook: false, money: [] });
    return days.get(dateKey)!;
  };

  const byDay = new Map<string, LessonSplitRow[]>();
  for (const row of rows) byDay.set(row.dateKey, [...(byDay.get(row.dateKey) ?? []), row]);
  for (const [dateKey, list] of byDay) {
    const statuses = list.map((r) => r.status);
    const d = day(dateKey);
    d.status = statuses.some((s) => s === "PENDING" || s === "CHANGED")
      ? "PENDING"
      : statuses.some((s) => s === "NOT_TAKEN")
        ? "NOT_TAKEN"
        : statuses.every((s) => s === "UPCOMING")
          ? "UPCOMING"
          : "VERIFIED";
    d.needsLook = list.some((r) => (r.status === "PENDING" || r.status === "CHANGED") && r.flags.length > 0);
  }
  for (const e of entries) {
    const category = isEntryCategory(e.category) ? ENTRY_CATEGORIES[e.category] : null;
    day(toTaipeiDateKey(e.date)).money.push({
      kind: "entry",
      label: e.description || category?.label || e.category,
      amount: signedEntryAmount(e.category, e.amount),
    });
  }
  for (const r of remittances) {
    day(toTaipeiDateKey(r.sentOn)).money.push({
      kind: "remittance",
      label: `${r.fromUser.name} 送回${r.status === "PENDING" ? "（等確認）" : ""}`,
      amount: r.amount,
    });
  }
  const payday = setting?.payday ?? 5;
  const lastDay = new Date(end.getTime() - 1);
  if (payday <= Number(toTaipeiDateKey(lastDay).slice(8))) {
    day(`${monthKey}-${String(payday).padStart(2, "0")}`).money.unshift({ kind: "payday", label: "發薪日", amount: null });
  }

  return { month: monthKey, days: [...days.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey)) };
}
