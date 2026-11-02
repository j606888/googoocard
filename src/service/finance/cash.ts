import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { parseTaipeiDateRange, parseTaipeiMonthRange } from "@/lib/taipei-date";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { assertFinanceMember, requireVenueInClassroom } from "./config";

/** 真實日曆日期（2026-02-31 → 400）。 */
export const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Invalid date");

export function dateOf(ymd: string): Date {
  return parseTaipeiDateRange(ymd).start;
}

/** `?month=YYYY-MM`（可省略）→ date 範圍條件。 */
export function monthFilter(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  if (!month) return {};
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ApiError(400, "INVALID_MONTH", "month must be YYYY-MM");
  }
  const { start, end } = parseTaipeiMonthRange(month);
  return { date: { gte: start, lt: end } };
}

export const expenseSelect = {
  id: true,
  date: true,
  amount: true,
  locationId: true,
  category: true,
  paidByUserId: true,
  note: true,
} as const;

export const transferSelect = {
  id: true,
  date: true,
  amount: true,
  fromUserId: true,
  toKind: true,
  toUserId: true,
  toTeacherId: true,
  toVenueId: true,
  settlementMonth: true,
  note: true,
} as const;

export const expenseSchema = z.object({
  date: ymdSchema,
  amount: z.number().int().positive(),
  locationId: z.number().int().positive(),
  category: z.string().trim().min(1).max(20),
  paidByUserId: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
});

export const transferSchema = z.object({
  date: ymdSchema,
  amount: z.number().int().positive(),
  fromUserId: z.number().int().positive(),
  toKind: z.enum(["USER", "TEACHER", "SELF", "VENUE"]),
  toUserId: z.number().int().positive().optional(),
  toTeacherId: z.number().int().positive().optional(),
  toVenueId: z.number().int().positive().optional(),
  settlementMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function createExpense(
  classroomId: number,
  userId: number,
  body: z.infer<typeof expenseSchema>
) {
  const location = await prisma.location.findFirst({ where: { id: body.locationId, classroomId } });
  if (!location) throw new ApiError(404, "NOT_FOUND", "Location not found");
  await assertFinanceMember(body.paidByUserId, classroomId);
  return prisma.financeExpense.create({
    data: {
      classroomId,
      date: dateOf(body.date),
      amount: body.amount,
      locationId: body.locationId,
      category: body.category,
      paidByUserId: body.paidByUserId,
      note: body.note ?? null,
      createdById: userId,
    },
    select: expenseSelect,
  });
}

export async function createTransfer(
  classroomId: number,
  userId: number,
  body: z.infer<typeof transferSchema>
) {
  await assertFinanceMember(body.fromUserId, classroomId);
  let toUserId: number | null = null;
  let toTeacherId: number | null = null;
  let toVenueId: number | null = null;
  if (body.toKind === "SELF") {
    toUserId = body.fromUserId;
  } else if (body.toKind === "USER") {
    if (!body.toUserId) throw new ApiError(400, "TARGET_REQUIRED", "toUserId is required");
    await assertFinanceMember(body.toUserId, classroomId);
    toUserId = body.toUserId;
  } else if (body.toKind === "TEACHER") {
    if (!body.toTeacherId) throw new ApiError(400, "TARGET_REQUIRED", "toTeacherId is required");
    const t = await prisma.teacher.findFirst({ where: { id: body.toTeacherId, classroomId } });
    if (!t) throw new ApiError(404, "NOT_FOUND", "Teacher not found");
    toTeacherId = t.id;
  } else {
    if (!body.toVenueId) throw new ApiError(400, "TARGET_REQUIRED", "toVenueId is required");
    const v = await requireVenueInClassroom(body.toVenueId, classroomId);
    toVenueId = v.id;
  }
  return prisma.financeTransfer.create({
    data: {
      classroomId,
      date: dateOf(body.date),
      amount: body.amount,
      fromUserId: body.fromUserId,
      toKind: body.toKind,
      toUserId,
      toTeacherId,
      toVenueId,
      settlementMonth: body.settlementMonth ?? null,
      note: body.note ?? null,
      createdById: userId,
    },
    select: transferSelect,
  });
}

export async function refundCard(input: {
  classroomId: number;
  userId: number;
  studentCardId: number;
  amount: number;
  paidByUserId: number;
  date: Date;
}) {
  const { classroomId, userId, studentCardId, amount, paidByUserId, date } = input;
  const card = await prisma.studentCard.findFirst({
    where: { id: studentCardId, student: { classroomId } },
    select: {
      id: true,
      studentId: true,
      isPaid: true,
      expiredAt: true,
      finalPrice: true,
      totalSessions: true,
      remainingSessions: true,
    },
  });
  if (!card) throw new ApiError(404, "NOT_FOUND", "Card not found");
  if (!card.isPaid) throw new ApiError(400, "CARD_NOT_PAID", "Card is not paid");
  if (card.expiredAt) throw new ApiError(400, "CARD_CLOSED", "Card is already closed");
  await assertFinanceMember(paidByUserId, classroomId);
  // amount ≤ finalPrice / totalSessions × remaining，用整數乘法避免浮點誤差。
  if (amount * card.totalSessions > card.finalPrice * card.remainingSessions) {
    throw new ApiError(400, "REFUND_EXCEEDS_VALUE", "Refund exceeds remaining value");
  }
  try {
    const refund = await prisma.$transaction(async (tx) => {
      const r = await tx.financeRefund.create({
        data: { studentCardId, amount, paidByUserId, date, createdById: userId },
        select: { id: true, studentCardId: true, amount: true, paidByUserId: true, date: true },
      });
      await tx.studentCard.update({
        where: { id: studentCardId },
        data: { expiredAt: date, closedReason: "REFUNDED" },
      });
      return r;
    });
    await refreshNeedsRenewalTag(card.studentId, classroomId);
    return refund;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new ApiError(400, "CARD_CLOSED", "Card is already refunded");
    }
    throw e;
  }
}
