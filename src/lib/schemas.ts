import { z } from "zod";
import { DanceType } from "@prisma/client";

/**
 * Request schemas for the routes with money or card-balance semantics.
 *
 * These are the ones where a bad value does lasting damage: a negative price or
 * a string where a number belongs lands in `StudentCard` and silently skews
 * revenue for as long as the card exists. Routes without that exposure are
 * being migrated as they're touched — see docs/roadmap.md P1-2.
 */

/** A positive integer that arrives as either a number or a numeric string. */
export const positiveInt = z.coerce.number().int().positive();

/** Money in whole NTD. Zero is allowed — comped and 100%-discounted cards exist. */
export const money = z.coerce.number().int().min(0);

export const danceType = z.enum(DanceType);

/** Card sessions. Upper bound is a typo guard, not a business rule. */
export const sessions = z.coerce.number().int().min(1).max(1000);

export const buyStudentCardSchema = z.object({
  cardId: positiveInt,
  sessions,
  // The teacher can discount at the point of sale, so this is NOT required to
  // equal the card's list price — but it must still be a sane amount.
  price: money,
  lessonId: positiveInt.optional(),
  isPaid: z.boolean().optional().default(true),
});

export const convertStudentCardSchema = z.object({
  targetCardId: positiveInt,
  // Omitted means "same number of sessions as the source card has left"; the
  // route resolves that, so it stays optional here.
  sessions: sessions.optional(),
  note: z.string().max(500).nullish(),
});

export const studentCardNoteSchema = z.object({
  note: z.string().max(500, "備註不能超過 500 字").nullable(),
});

export const cardSchema = z
  .object({
    name: z.string().trim().min(1, "請輸入卡片名稱").max(100),
    price: money,
    sessions,
    isPracticeCard: z.boolean().optional().default(false),
    danceType: danceType.nullish(),
  })
  // Mirrors the rule in docs/architecture.md: a practice card's dance type is
  // what decides who may buy and use it, so it can't be left blank. Living in
  // the schema keeps POST /api/cards and PATCH /api/cards/[id] from drifting.
  //
  // `params.apiCode` makes the response answer with the documented error string
  // instead of the generic validation shape — see errorResponse in apiRoute.ts.
  .superRefine((data, ctx) => {
    if (data.isPracticeCard && !data.danceType) {
      ctx.addIssue({
        code: "custom",
        message: "PRACTICE_CARD_REQUIRES_DANCE_TYPE",
        params: { apiCode: "PRACTICE_CARD_REQUIRES_DANCE_TYPE" },
        path: ["danceType"],
      });
    }
  });

export const takeAttendanceSchema = z.object({
  studentIds: z.array(positiveInt),
});

/** Classroom name. Trimmed so a whitespace-only name can't slip through. */
export const createClassroomSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
