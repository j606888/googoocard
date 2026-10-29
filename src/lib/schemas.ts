import { z } from "zod";
import { PaymentMethod, TodoType } from "@prisma/client";
import { DANCE_STYLE_COLORS } from "@/lib/danceStyles";
import { isExpoPushToken } from "@/lib/expoPush";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import { TEACHER_KINDS } from "@/lib/teachers";

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
  // 當場收款時怎麼付的（同確認收款）。選填：只送 isPaid 的舊版 App 照常可買；
  // isPaid:false 時兩者都忽略。末五碼只對轉帳有意義，路由會丟掉現金帶來的。
  paymentMethod: z.enum(PaymentMethod).nullish(),
  paymentReference: z.string().trim().max(20).nullish(),
  // 卡片備註（學生看不到），跟事後 PATCH 改的是同一欄；空白 = 不填。
  note: z.string().max(500).nullish(),
});

/**
 * 確認收款（POST .../confirm-payment）。全部選填：舊版 App 不帶 body 也能確認。
 * `receiverUserId` = 收款人（錢現在在誰手上），預設是確認的人；必須是本教室成員。
 */
export const confirmPaymentSchema = z.object({
  paymentMethod: z.enum(PaymentMethod).optional(),
  paymentReference: z.string().trim().max(20).nullish(),
  receiverUserId: positiveInt.optional(),
});

/**
 * 登記體驗課（POST /api/lessons/[id]/trials）：選既有學生（`studentId`）或
 * 直接打名字建新學生（`newStudentName`），二擇一。`finalPrice` 省略 = 依
 * 新舊生帶預設價（src/lib/trialPrice.ts）；$0 一律視為已付。
 */
export const registerTrialSchema = z
  .object({
    studentId: positiveInt.optional(),
    newStudentName: z.string().trim().min(1).max(50).optional(),
    cardId: positiveInt,
    finalPrice: money.optional(),
    isPaid: z.boolean(),
    paymentMethod: z.enum(PaymentMethod).nullish(),
    paymentReference: z.string().trim().max(20).nullish(),
  })
  .refine((data) => (data.studentId === undefined) !== (data.newStudentName === undefined), {
    message: "Pass exactly one of studentId / newStudentName",
    path: ["studentId"],
  });

export const convertStudentCardSchema = z.object({
  targetCardId: positiveInt,
  // Omitted means "the residual value converted at the target card's price,
  // rounded" (src/domains/cardConversion); the route resolves that.
  sessions: sessions.optional(),
  note: z.string().max(500).nullish(),
});

/** 課卡轉讓：剩餘堂數整批給同教室的另一位學生（src/service/studentCardTransfer.ts）。 */
export const transferStudentCardSchema = z.object({
  toStudentId: positiveInt,
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
    // 體驗課卡：老師在課程頁登記體驗時用，舊生預設 $0（src/lib/trialPrice.ts）。
    isTrial: z.boolean().optional().default(false),
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

// ── 分部 ────────────────────────────────────────────────────────────────────

const locationName = z.string().trim().min(1, "請輸入分部名稱").max(30);
/** Blank clears the address. */
const locationAddress = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null)
  .nullable();

export const createLocationSchema = z.object({
  name: locationName,
  address: locationAddress.optional(),
});

export const updateLocationSchema = z.object({
  name: locationName.optional(),
  address: locationAddress.optional(),
  archived: z.boolean().optional(),
});

/** The classroom's full location list in its new order (archived included). */
export const reorderLocationsSchema = z.object({
  ids: z.array(positiveInt).min(1),
});

/** 套用到既有課程：老師勾選的課（只改還沒設定分部的）。 */
export const assignLocationSchema = z.object({
  locationId: positiveInt,
  lessonIds: z.array(positiveInt).min(1).max(500),
});

export const locationSettingsSchema = z.object({
  lineListed: z.boolean(),
});

// ── 老師 ────────────────────────────────────────────────────────────────────

const teacherName = z.string().trim().min(1, "請輸入老師名字").max(30);
/** Blank clears the note. */
const teacherNote = z
  .string()
  .trim()
  .max(500)
  .transform((note) => note || null);

export const createTeacherSchema = z.object({
  name: teacherName,
  /** Omitted: the first palette colour no active teacher uses. */
  color: danceStyleColor.optional(),
  note: teacherNote.nullish(),
  kind: z.enum(TEACHER_KINDS).optional(),
});

export const updateTeacherSchema = z.object({
  name: teacherName.optional(),
  color: danceStyleColor.optional(),
  note: teacherNote.nullish(),
  kind: z.enum(TEACHER_KINDS).optional(),
  archived: z.boolean().optional(),
});

/** PUT …/periods/[periodId]/assistants — the whole set, like attendance's studentIds. */
export const setPeriodAssistantsSchema = z.object({
  teacherIds: z.array(z.number().int().positive()).max(10),
});

/** `?month=YYYY-MM` on the teacher stats routes; omitted = this Taipei month. */
export const teacherMonthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

// ── App 推播 ────────────────────────────────────────────────────────────────

export const pushTokenSchema = z.object({
  token: z.string().refine(isExpoPushToken, { message: "Not an Expo push token" }),
  platform: z.enum(["ios", "android"]),
});

export const deletePushTokenSchema = z.object({
  token: z.string().min(1),
});

// 瀏覽器 PushSubscription.toJSON() 的形狀。
export const webPushSubscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const deleteWebPushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
});

export const notificationPreferenceSchema = z.object({
  type: z.enum(TodoType),
  enabled: z.boolean(),
});

const assignableRole = z.enum(ASSIGNABLE_ROLES);

export const createInviteSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(100),
  role: assignableRole.default("assistant"),
  /** Required for a teacher invite; the joiner is linked to it. */
  teacherId: positiveInt.nullish(),
});

/** Either field may be sent alone. `teacherId: null` unlinks. */
export const updateMembershipSchema = z.object({
  role: assignableRole.optional(),
  teacherId: positiveInt.nullable().optional(),
  /** The full list the member should end up with (src/lib/permissions.ts); stored as grants/revokes. */
  permissions: z.array(z.string()).optional(),
});
