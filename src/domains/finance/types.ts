import { z } from "zod";

/**
 * 分帳的去向（docs/finance-lite.md §3）。
 * - `lessonFund`：這堂課開課分部的公積金（課換分部時跟著換）。
 * - `fund`：指定某個分部的公積金。
 * - `holder`：卡錢所屬的分部（只出現在 rest／deficit；照各分部的收入比例拆）。
 */
export type Payee =
  | { type: "teacher"; teacherId: number }
  | { type: "venue"; venueId: number; packId?: number }
  | { type: "lessonFund" }
  | { type: "fund"; locationId: number }
  | { type: "holder" };

export type LinePayee = Exclude<Payee, { type: "holder" }>;

export type SplitLine =
  | { kind: "fixed"; amount: number; to: LinePayee }
  | { kind: "percent"; pct: number; base: "income" | "remaining"; to: LinePayee }
  // 存在規則裡；計算前換成 fixed（每次付的價或次數包單價）。
  | { kind: "venuePack"; venueId: number };

export type RestTarget =
  | { type: "holder" }
  | { type: "teachers"; shares: { teacherId: number; weight: number }[] }
  | { type: "lessonFund" }
  | { type: "fund"; locationId: number };

export type SplitRule = {
  lines: SplitLine[];
  rest: RestTarget;
};

export type ResolvedLine = Exclude<SplitLine, { kind: "venuePack" }>;

export type Allocation = {
  payee: Payee;
  amount: number;
  source: "line" | "rest" | "deficit";
};

const id = z.number().int();

const linePayeeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("teacher"), teacherId: id }),
  z.object({ type: z.literal("venue"), venueId: id, packId: id.optional() }),
  z.object({ type: z.literal("lessonFund") }),
  z.object({ type: z.literal("fund"), locationId: id }),
]);

const splitLineSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), amount: z.number().min(0), to: linePayeeSchema }),
  z.object({
    kind: z.literal("percent"),
    pct: z.number().min(0).max(100),
    base: z.enum(["income", "remaining"]),
    to: linePayeeSchema,
  }),
  z.object({ kind: z.literal("venuePack"), venueId: id }),
]);

const restTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("holder") }),
  z.object({
    type: z.literal("teachers"),
    shares: z.array(z.object({ teacherId: id, weight: z.number().gt(0) })).min(1),
  }),
  z.object({ type: z.literal("lessonFund") }),
  z.object({ type: z.literal("fund"), locationId: id }),
]);

export const splitRuleSchema = z.object({
  lines: z.array(splitLineSchema),
  rest: restTargetSchema,
});

/** 新規則的預設：沒有任何行，剩下的全部留給卡錢的分部。 */
export const EMPTY_RULE: SplitRule = { lines: [], rest: { type: "holder" } };
