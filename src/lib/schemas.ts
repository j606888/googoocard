import { z } from "zod";
import { DANCE_STYLE_COLORS } from "@/lib/danceStyles";

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
  // Omitted means "the residual value converted at the target card's price,
  // rounded" (src/domains/cardConversion); the route resolves that.
  sessions: sessions.optional(),
  note: z.string().max(500).nullish(),
});

/**
 * A lesson period's time slot (PATCH .../periods/[periodId]).
 *
 * Re-dating a period exists because of docs/roadmap.md P2-2: a class that was
 * rained off but never re-dated dragged two weeks of attendance onto the wrong
 * days, and without this the only fix was delete-and-recreate, which throws the
 * period's attendance away.
 */
export const periodTimesSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((data) => data.endTime > data.startTime, {
    path: ["endTime"],
    message: "結束時間必須晚於開始時間",
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
    danceStyleId: positiveInt.nullish(),
  })
  // Mirrors the rule in docs/architecture.md: a practice card's dance type is
  // what decides who may buy and use it, so it can't be left blank. Living in
  // the schema keeps POST /api/cards and PATCH /api/cards/[id] from drifting.
  //
  // `params.apiCode` makes the response answer with the documented error string
  // instead of the generic validation shape — see errorResponse in apiRoute.ts.
  .superRefine((data, ctx) => {
    if (data.isPracticeCard && !data.danceStyleId) {
      ctx.addIssue({
        code: "custom",
        message: "PRACTICE_CARD_REQUIRES_DANCE_TYPE",
        params: { apiCode: "PRACTICE_CARD_REQUIRES_DANCE_TYPE" },
        path: ["danceStyleId"],
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

const danceStyleName = z.string().trim().min(1, "請輸入舞種名稱").max(30);
const danceStyleColor = z.enum(DANCE_STYLE_COLORS);

export const createDanceStyleSchema = z.object({
  name: danceStyleName,
  color: danceStyleColor,
  hasLevels: z.boolean().optional().default(false),
});

/** The classroom's full style list in its new order — archived styles included,
 * so every `sortOrder` is rewritten in one go and no two styles tie. */
export const reorderDanceStylesSchema = z.object({
  ids: z.array(positiveInt).min(1),
});

/** Every field optional: rename, recolour, toggle levels, reorder, archive/restore. */
export const updateDanceStyleSchema = z.object({
  name: danceStyleName.optional(),
  color: danceStyleColor.optional(),
  hasLevels: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  archived: z.boolean().optional(),
});
