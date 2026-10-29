/**
 * 每堂分帳（水庫第二步，docs/finance-db.md §1、§4）。純函式，前後端共用。
 *
 *   點名收入 − 場地費 − 助教費 − 抽成（扣完前兩項 × %，四捨五入到元）＝ 分給老師
 *
 * 拆帳：剩下的平分（或照課程自訂比例），每人照取整規則捨去，零頭歸營收負責人或水庫基金。
 * 鐘點費：每位老師拿固定的錢。不用算：收入全部留在教室。每天固定的費用由當天的課平攤，
 * 除不盡的早的堂多 1 元。
 */

export type TeacherPay = "NONE" | "HOURLY" | "SPLIT";
export type FeeMode = "NONE" | "PER_LESSON" | "PER_DAY";
export type VenuePayee = "MEMBER" | "EXTERNAL";
export type RemainderTo = "REVENUE_OWNER" | "FUND";
export type Share = { teacherId: number; pct: number };

/** 規則的一層。欄位 null／undefined ＝ 沿用上一層。 */
export type RuleLayer = {
  id: number;
  teacherPay?: TeacherPay | null;
  hourlyFee?: number | null;
  venueMode?: FeeMode | null;
  venueAmount?: number | null;
  venuePayee?: VenuePayee | null;
  venueTeacherId?: number | null;
  assistantMode?: FeeMode | null;
  assistantAmount?: number | null;
  commissionPct?: number | null;
  manual?: boolean | null;
  roundTo?: number | null;
  remainderTo?: RemainderTo | null;
  shares?: Share[];
};

export type ResolvedRule = {
  teacherPay: TeacherPay;
  hourlyFee: number;
  venueMode: FeeMode;
  venueAmount: number;
  venuePayee: VenuePayee;
  venueTeacherId: number | null;
  assistantMode: FeeMode;
  assistantAmount: number;
  commissionPct: number;
  manual: boolean;
  roundTo: number;
  remainderTo: RemainderTo;
  shares: Share[];
  /** 用到的規則列，課程 → 分部 → 全教室。 */
  ruleIds: number[];
};

/** 新教室什麼都不設＝不用算，錢全部留在教室。 */
export const DEFAULT_RULE: Omit<ResolvedRule, "ruleIds"> = {
  teacherPay: "NONE",
  hourlyFee: 0,
  venueMode: "NONE",
  venueAmount: 0,
  venuePayee: "EXTERNAL",
  venueTeacherId: null,
  assistantMode: "NONE",
  assistantAmount: 0,
  commissionPct: 0,
  manual: false,
  roundTo: 1,
  remainderTo: "FUND",
  shares: [],
};

const INHERITED = [
  "teacherPay",
  "hourlyFee",
  "venueMode",
  "venueAmount",
  "venuePayee",
  "venueTeacherId",
  "assistantMode",
  "assistantAmount",
  "commissionPct",
] as const;

/** 三層合起來：每個欄位從課程 → 分部 → 全教室找第一個有寫的。 */
export function resolveRule(layers: {
  classroom?: RuleLayer | null;
  location?: RuleLayer | null;
  lesson?: RuleLayer | null;
}): ResolvedRule {
  const chain = [layers.lesson, layers.location, layers.classroom].filter(
    (layer): layer is RuleLayer => !!layer
  );
  const rule = { ...DEFAULT_RULE, ruleIds: chain.map((layer) => layer.id) } as ResolvedRule;
  for (const key of INHERITED) {
    const found = chain.find((layer) => layer[key] !== null && layer[key] !== undefined);
    if (found) (rule as Record<string, unknown>)[key] = found[key];
  }
  // 只有課程層能設：手動結算、多位老師的比例。只有全教室層能設：取整、零頭。
  rule.manual = layers.lesson?.manual ?? false;
  rule.shares = layers.lesson?.shares ?? [];
  rule.roundTo = layers.classroom?.roundTo ?? DEFAULT_RULE.roundTo;
  rule.remainderTo = layers.classroom?.remainderTo ?? DEFAULT_RULE.remainderTo;
  return rule;
}

/** amount 平攤成 count 份，除不盡的從前面開始多 1 元（$500 ÷ 3 → 167、167、166）。 */
export function allocate(amount: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(amount / count);
  const extra = amount - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

export type PeriodInput = {
  periodId: number;
  startTime: Date;
  /** 台北日期 YYYY-MM-DD。 */
  dateKey: string;
  locationId: number | null;
  /** 點名收入（含暫估），整數。 */
  revenue: number;
  /** 其中暫估的部分（沒卡的人）。 */
  estimated: number;
  teacherIds: number[];
  assistantIds: number[];
  rule: ResolvedRule;
};

export type PeriodFees = {
  venueFee: number;
  assistantFees: { teacherId: number; amount: number }[];
};

const byStart = (a: PeriodInput, b: PeriodInput) =>
  a.startTime.getTime() - b.startTime.getTime() || a.periodId - b.periodId;

/**
 * 一批堂的場地費、助教費。每天固定的，照同一天（場地費再加同一分部、同一筆收費）
 * 的堂數平攤；手動結算的堂不算。傳進來的要是完整的日子，不然平攤會不對。
 */
export function allocateFees(periods: PeriodInput[]): Map<number, PeriodFees> {
  const fees = new Map<number, PeriodFees>(
    periods.map((p) => [p.periodId, { venueFee: 0, assistantFees: [] }])
  );
  const auto = periods.filter((p) => !p.rule.manual);

  const venueDays = new Map<string, PeriodInput[]>();
  for (const p of auto) {
    const { venueMode, venueAmount, venuePayee, venueTeacherId } = p.rule;
    if (venueMode === "PER_LESSON") fees.get(p.periodId)!.venueFee = venueAmount;
    if (venueMode !== "PER_DAY") continue;
    const key = [p.dateKey, p.locationId, venueAmount, venuePayee, venueTeacherId].join("|");
    venueDays.set(key, [...(venueDays.get(key) ?? []), p]);
  }
  for (const group of venueDays.values()) {
    const sorted = [...group].sort(byStart);
    allocate(sorted[0].rule.venueAmount, sorted.length).forEach((amount, i) => {
      fees.get(sorted[i].periodId)!.venueFee = amount;
    });
  }

  const assistantDays = new Map<string, PeriodInput[]>();
  for (const p of auto) {
    const { assistantMode, assistantAmount } = p.rule;
    for (const teacherId of p.assistantIds) {
      if (assistantMode === "PER_LESSON") {
        fees.get(p.periodId)!.assistantFees.push({ teacherId, amount: assistantAmount });
      }
      if (assistantMode !== "PER_DAY") continue;
      const key = [p.dateKey, teacherId, assistantAmount].join("|");
      assistantDays.set(key, [...(assistantDays.get(key) ?? []), p]);
    }
  }
  for (const [key, group] of assistantDays) {
    const teacherId = Number(key.split("|")[1]);
    const sorted = [...group].sort(byStart);
    allocate(sorted[0].rule.assistantAmount, sorted.length).forEach((amount, i) => {
      fees.get(sorted[i].periodId)!.assistantFees.push({ teacherId, amount });
    });
  }
  return fees;
}

export type SplitFlag =
  | "NO_CARD" // 有人沒卡，照暫估
  | "MISSING_SHARE_TEACHER" // 課程設了比例，但這堂少掛了其中一位老師
  | "NO_TEACHER" // 要分給老師，這堂卻沒掛老師
  | "MANUAL"; // 整門課手動結算

export type SplitLine = { teacherId: number; amount: number };

export type SplitResult = {
  revenue: number;
  estimated: number;
  venueFee: number;
  /** 付給誰：成員（老師資料）或 null＝外面的場地。 */
  venueTeacherId: number | null;
  assistantFee: number;
  assistantLines: SplitLine[];
  commission: number;
  teacherLines: SplitLine[];
  remainder: number;
  /** 零頭歸誰；null ＝ 進水庫基金。 */
  remainderTeacherId: number | null;
  /** 這堂留在教室的錢：收入 − 付出去的（可能是負的）。 */
  fund: number;
  flags: SplitFlag[];
};

const floorTo = (value: number, step: number) => Math.floor(value / step) * step;

/** 算一堂。fees 來自 allocateFees；revenueOwnerTeacherId ＝ 營收負責人的老師資料。 */
export function splitPeriod(
  input: PeriodInput,
  fees: PeriodFees,
  { revenueOwnerTeacherId }: { revenueOwnerTeacherId: number | null }
): SplitResult {
  const { rule, revenue } = input;
  const flags: SplitFlag[] = [];
  if (input.estimated > 0) flags.push("NO_CARD");
  if (rule.manual) flags.push("MANUAL");
  if (rule.teacherPay !== "NONE" && input.teacherIds.length === 0) flags.push("NO_TEACHER");

  const assistantFee = fees.assistantFees.reduce((sum, line) => sum + line.amount, 0);
  const base = revenue - fees.venueFee - assistantFee;
  const commission =
    rule.teacherPay === "SPLIT" && base > 0 ? Math.round((base * rule.commissionPct) / 100) : 0;

  let teacherLines: SplitLine[] = [];
  let remainder = 0;
  if (rule.teacherPay === "HOURLY") {
    teacherLines = input.teacherIds.map((teacherId) => ({ teacherId, amount: rule.hourlyFee }));
  } else if (rule.teacherPay === "SPLIT" && input.teacherIds.length > 0) {
    const pool = Math.max(0, base - commission);
    const sharesComplete =
      rule.shares.length > 0 &&
      rule.shares.every((share) => input.teacherIds.includes(share.teacherId));
    if (rule.shares.length > 0 && !sharesComplete) flags.push("MISSING_SHARE_TEACHER");
    teacherLines = sharesComplete
      ? rule.shares.map((share) => ({
          teacherId: share.teacherId,
          amount: floorTo((pool * share.pct) / 100, rule.roundTo),
        }))
      : input.teacherIds.map((teacherId) => ({
          teacherId,
          amount: floorTo(pool / input.teacherIds.length, rule.roundTo),
        }));
    remainder = pool - teacherLines.reduce((sum, line) => sum + line.amount, 0);
  }

  const remainderTeacherId =
    remainder > 0 && rule.remainderTo === "REVENUE_OWNER" ? revenueOwnerTeacherId : null;
  const paidToTeachers =
    teacherLines.reduce((sum, line) => sum + line.amount, 0) +
    (remainderTeacherId !== null ? remainder : 0);

  return {
    revenue,
    estimated: input.estimated,
    venueFee: fees.venueFee,
    venueTeacherId: rule.venuePayee === "MEMBER" ? rule.venueTeacherId : null,
    assistantFee,
    assistantLines: fees.assistantFees,
    commission,
    teacherLines,
    remainder,
    remainderTeacherId,
    fund: revenue - fees.venueFee - assistantFee - paidToTeachers,
    flags,
  };
}
