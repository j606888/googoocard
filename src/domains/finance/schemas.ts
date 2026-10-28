import { z } from "zod";
import { ENTRY_CATEGORY_KEYS } from "./money";

const id = z.number().int().positive();
const money = z.number().int().min(0).max(100_000_000);
const positiveMoney = z.number().int().min(1).max(100_000_000);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式是 YYYY-MM-DD");
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  text(max)
    .nullish()
    .transform((v) => (v ? v : null));
const reason = text(200).min(1, "要寫原因");

export const QUESTS = ["trial", "viewedBackpack", "notifiedMembers"] as const;
export type Quest = (typeof QUESTS)[number];

/** 建城 5 題一次送。 */
export const setupSchema = z.object({
  revenueOwnerUserId: id,
  startDate: dateKey,
  openingBalance: money,
  /** 選填：null ＝ 略過，不顯示建城貸款。 */
  openingOwnerLoan: money.nullable(),
  openingCustody: z.array(z.object({ userId: id, amount: positiveMoney })).max(50).default([]),
});

/** 建城前只選營收負責人（丁丁的新手任務）。 */
export const revenueOwnerSchema = z.object({ revenueOwnerUserId: id });

/** 建城之後改設定。改期初數字或換營收負責人要寫原因。 */
export const patchSettingSchema = z.object({
  revenueOwnerUserId: id.optional(),
  openingBalance: money.optional(),
  openingOwnerLoan: money.nullable().optional(),
  overdueDays: z.number().int().min(1).max(90).optional(),
  reason: text(200).optional(),
});

export const remittanceSchema = z.object({
  amount: positiveMoney,
  method: z.enum(["CASH", "TRANSFER"]),
  reference: optionalText(10),
  sentOn: dateKey,
  note: optionalText(200),
});

export const rejectSchema = z.object({ reason });

export const entrySchema = z
  .object({
    date: dateKey,
    category: z.enum(ENTRY_CATEGORY_KEYS as [string, ...string[]]),
    amount: positiveMoney,
    payeeUserId: id.nullish().transform((v) => v ?? null),
    payeeName: optionalText(60),
    description: optionalText(200),
  })
  .refine((v) => !(v.payeeUserId && v.payeeName), { message: "付給成員或填名字，選一個", path: ["payeeName"] });

export const patchEntrySchema = z.object({ entry: entrySchema, reason });
export const voidEntrySchema = z.object({ reason });

export const questSchema = z.object({ quest: z.enum(QUESTS) });

export type SetupInput = z.infer<typeof setupSchema>;
export type RemittanceInput = z.infer<typeof remittanceSchema>;
export type EntryInput = z.infer<typeof entrySchema>;
export type PatchSettingInput = z.infer<typeof patchSettingSchema>;

// ---------- 第二步：分帳規則、驗收

const feeMode = z.enum(["NONE", "PER_LESSON", "PER_DAY"]);
const pct = z.number().int().min(0).max(100);

/** 存一層分帳規則。欄位不送或 null ＝ 沿用上一層。 */
export const splitRuleSchema = z.object({
  scope: z.enum(["CLASSROOM", "LOCATION", "LESSON"]),
  locationId: id.nullish(),
  lessonId: id.nullish(),
  /** 不送：這一層第一次設＝從頭算，之後＝下個月 1 號。 */
  applyFrom: z.enum(["THIS_MONTH", "NEXT_MONTH"]).optional(),
  teacherPay: z.enum(["NONE", "HOURLY", "SPLIT"]).nullish(),
  hourlyFee: money.nullish(),
  venueMode: feeMode.nullish(),
  venueAmount: money.nullish(),
  venuePayee: z.enum(["MEMBER", "EXTERNAL"]).nullish(),
  venueTeacherId: id.nullish(),
  assistantMode: feeMode.nullish(),
  assistantAmount: money.nullish(),
  commissionPct: pct.nullish(),
  manual: z.boolean().nullish(),
  roundTo: z.union([z.literal(1), z.literal(10), z.literal(100)]).nullish(),
  remainderTo: z.enum(["REVENUE_OWNER", "FUND"]).nullish(),
  shares: z.array(z.object({ teacherId: id, pct })).max(10).optional(),
  reason: optionalText(200),
});
export type SplitRuleInput = z.infer<typeof splitRuleSchema>;

/** GET /api/finance/lessons?from=&to=（台北日期，含頭含尾，最多 62 天）。 */
export const lessonSplitsQuerySchema = z
  .object({ from: dateKey, to: dateKey })
  .refine(({ from, to }) => from <= to, "from 要在 to 之前")
  .refine(
    ({ from, to }) => (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 62,
    "一次最多 62 天"
  );

/** 驗收：batch ＝ 整批，只收沒有任何提醒的堂。 */
export const verifyLessonsSchema = z.object({
  periodIds: z.array(id).min(1).max(200),
  batch: z.boolean().default(false),
});
