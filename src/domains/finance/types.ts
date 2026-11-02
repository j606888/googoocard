import { z } from "zod";

export type Payee =
  | { type: "teacher"; teacherId: number }
  | { type: "fund"; locationId: number }
  | { type: "venue"; venueId: number; packId?: number };

export type SplitLine =
  | { kind: "fixed"; amount: number; to: Payee }
  | { kind: "percent"; pct: number; base: "income" | "remaining"; to: Payee }
  | { kind: "venuePack"; venueId: number }; // stored in rules; Task 5 swaps it for fixed + packId before computing

export type RestTarget =
  | { type: "teachers"; shares: { teacherId: number; weight: number }[] }
  | { type: "fund"; locationId: number };

export type SplitRule = {
  lines: SplitLine[];
  rest: RestTarget;
  fundLocationId: number;
};

export type ResolvedLine = Exclude<SplitLine, { kind: "venuePack" }>;

export type Allocation = {
  payee: Payee;
  amount: number;
  source: "line" | "rest" | "deficit";
};

const id = z.number().int();

const payeeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("teacher"), teacherId: id }),
  z.object({ type: z.literal("fund"), locationId: id }),
  z.object({ type: z.literal("venue"), venueId: id, packId: id.optional() }),
]);

const splitLineSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), amount: z.number().min(0), to: payeeSchema }),
  z.object({
    kind: z.literal("percent"),
    pct: z.number().min(0).max(100),
    base: z.enum(["income", "remaining"]),
    to: payeeSchema,
  }),
  z.object({ kind: z.literal("venuePack"), venueId: id }),
]);

const restTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("teachers"),
    shares: z
      .array(z.object({ teacherId: id, weight: z.number().gt(0) }))
      .min(1),
  }),
  z.object({ type: z.literal("fund"), locationId: id }),
]);

export const splitRuleSchema = z.object({
  lines: z.array(splitLineSchema),
  rest: restTargetSchema,
  fundLocationId: id,
});
