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
