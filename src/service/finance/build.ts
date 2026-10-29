import prisma from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/apiError";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import type { BuildSplitInput } from "@/domains/finance/schemas";
import type { SplitResult } from "@/domains/finance/split";
import { requireReady } from "./setting";
import { computeLessonSplits, EPOCH, loadRuleRows, rulesFromRows, writeRule, type RuleKnobs, type RuleRow } from "./split";

/**
 * 建城第 2～4 章（docs/finance-plan.md §4.3，設計稿「水庫建城（第一次設定）」）。
 * 居民（老師身分）、場地（分部）各自走老師、分部的 API；這裡只管分帳規則：
 * 全教室一層＋每個分部的場地費，一次存、從頭算。開城前先用最近點過名的一堂試算。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 全教室那一層有設＝分帳蓋好了（選「不用算」也算）。 */
export async function isSplitBuilt(classroomId: number) {
  return (await prisma.financeSplitRule.count({ where: { classroomId, scope: "CLASSROOM" } })) > 0;
}

type Layer = { locationId: number | null; knobs: RuleKnobs };
type Venue = BuildSplitInput["venues"][number];

const NO_VENUE = { venueMode: "NONE", venueAmount: null, venuePayee: null, venueTeacherId: null } as const;

function venueKnobs(v: Venue): Pick<RuleKnobs, "venueMode" | "venueAmount" | "venuePayee" | "venueTeacherId"> {
  if (v.venueMode === "NONE") return NO_VENUE;
  const member = v.venuePayee === "MEMBER";
  return { venueMode: v.venueMode, venueAmount: v.venueAmount ?? null, venuePayee: member ? "MEMBER" : "EXTERNAL", venueTeacherId: member ? v.venueTeacherId ?? null : null };
}

/** 把答案換成要寫的幾層規則；不合理的組合 400。 */
async function layersOf(classroomId: number, input: BuildSplitInput): Promise<Layer[]> {
  if (input.teacherPay === "HOURLY" && !input.hourlyFee) throw badRequest("HOURLY_FEE_REQUIRED", "鐘點費要填金額");
  if (input.assistantMode !== "NONE" && !input.assistantAmount) throw badRequest("ASSISTANT_FEE_REQUIRED", "助教費要填金額");
  for (const v of input.venues) {
    if (v.venueMode === "NONE") continue;
    if (!v.venueAmount) throw badRequest("VENUE_FEE_REQUIRED", "場地費要填金額");
    if (v.venuePayee === "MEMBER" && !v.venueTeacherId) throw badRequest("VENUE_PAYEE_REQUIRED", "要選付給哪位成員");
  }
  const locationIds = input.venues.flatMap((v) => (v.locationId ? [v.locationId] : []));
  if (new Set(locationIds).size !== locationIds.length || input.venues.filter((v) => v.locationId === null).length > 1) {
    throw badRequest("DUPLICATE_VENUE", "同一個地方只能設一次");
  }
  if (locationIds.length > 0) {
    const count = await prisma.location.count({ where: { id: { in: locationIds }, classroomId } });
    if (count !== locationIds.length) throw badRequest("LOCATION_NOT_FOUND");
  }
  const teacherIds = [...new Set(input.venues.flatMap((v) => (v.venueMode !== "NONE" && v.venuePayee === "MEMBER" && v.venueTeacherId ? [v.venueTeacherId] : [])))];
  if (teacherIds.length > 0) {
    const count = await prisma.teacher.count({ where: { id: { in: teacherIds }, classroomId } });
    if (count !== teacherIds.length) throw badRequest("TEACHER_NOT_FOUND");
  }

  const whole = input.venues.find((v) => v.locationId === null);
  const classroom: Layer = {
    locationId: null,
    knobs: {
      teacherPay: input.teacherPay,
      hourlyFee: input.teacherPay === "HOURLY" ? input.hourlyFee ?? null : null,
      ...(whole ? venueKnobs(whole) : NO_VENUE),
      assistantMode: input.assistantMode,
      assistantAmount: input.assistantMode === "NONE" ? null : input.assistantAmount ?? null,
      commissionPct: input.teacherPay === "SPLIT" ? input.commissionPct ?? 0 : null,
      manual: null,
      roundTo: input.roundTo,
      remainderTo: input.remainderTo,
      reason: "建城",
    },
  };
  const locations = input.venues.flatMap((v): Layer[] =>
    v.locationId
      ? [{
          locationId: v.locationId,
          knobs: {
            teacherPay: null, hourlyFee: null, ...venueKnobs(v), assistantMode: null, assistantAmount: null,
            commissionPct: null, manual: null, roundTo: null, remainderTo: null, reason: "建城",
          },
        }]
      : []
  );
  return [classroom, ...locations];
}

const targetOf = (layer: Layer) =>
  layer.locationId
    ? { scope: "LOCATION" as const, locationId: layer.locationId, lessonId: null }
    : { scope: "CLASSROOM" as const, locationId: null, lessonId: null };

export type BuildPreview = {
  periodId: number;
  lessonName: string;
  startTime: Date;
  dateKey: string;
  locationId: number | null;
  attendeeCount: number;
  /** 這天點過名的堂數（每天固定的費用平攤用）。 */
  periodsThatDay: number;
  split: SplitResult;
} | null;

/** 用還沒存的答案，算最近 60 天內點過名、有人來的最後一堂。沒有這種課回 null。 */
export async function previewBuild(classroomId: number, input: BuildSplitInput, now = new Date()): Promise<BuildPreview> {
  const layers = await layersOf(classroomId, input);
  const period = await prisma.lessonPeriod.findFirst({
    where: {
      lesson: { classroomId },
      attendanceTakenAt: { not: null },
      startTime: { gte: new Date(now.getTime() - 60 * DAY_MS), lte: now },
      attendanceRecords: { some: {} },
    },
    orderBy: { startTime: "desc" },
    select: { id: true, startTime: true },
  });
  if (!period) return null;

  const candidate: RuleRow[] = layers.map((layer, i) => ({
    id: -(i + 1),
    classroomId,
    ...targetOf(layer),
    effectiveFrom: EPOCH,
    ...layer.knobs,
    createdById: 0,
    createdAt: now,
    updatedAt: now,
    shares: [],
  }));
  // 課程那一層的例外照舊算；全教室、分部兩層換成這次的答案。
  const lessonRows = (await loadRuleRows(classroomId)).filter((r) => r.scope === "LESSON");
  const dateKey = toTaipeiDateKey(period.startTime);
  const { rows } = await computeLessonSplits(classroomId, dateKey, dateKey, now, rulesFromRows([...candidate, ...lessonRows]));
  const row = rows.find((r) => r.periodId === period.id);
  if (!row?.split) return null;
  return {
    periodId: row.periodId,
    lessonName: row.lessonName,
    startTime: row.startTime,
    dateKey: row.dateKey,
    locationId: row.locationId,
    attendeeCount: row.attendeeCount,
    periodsThatDay: rows.filter((r) => r.split).length,
    split: row.split,
  };
}

/** 開城：存全教室一層＋各分部場地費，都從頭算。主堡（第 1 章）要先蓋好；分帳設過了就 409。 */
export async function saveBuild(classroomId: number, userId: number, input: BuildSplitInput) {
  await requireReady(classroomId);
  if (await isSplitBuilt(classroomId)) throw new ApiError(409, "ALREADY_BUILT", "分帳已經設好了，要改請到分帳規則");
  const layers = await layersOf(classroomId, input);
  await prisma.$transaction(async (tx) => {
    for (const layer of layers) {
      await writeRule(tx, { classroomId, userId, target: targetOf(layer), effectiveFrom: EPOCH, knobs: layer.knobs, shares: [] });
    }
  });
  return { ok: true };
}
