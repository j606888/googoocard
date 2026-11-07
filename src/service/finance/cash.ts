import { syncLedger } from "@/service/ledger/sync";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { parseTaipeiDateRange, parseTaipeiMonthRange } from "@/lib/taipei-date";
import { refreshNeedsRenewalTag } from "@/service/studentTag";
import { ymdSchema } from "@/lib/schemas";
import { assertCustodian } from "./config";

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


export const expenseSchema = z.object({
  date: ymdSchema,
  amount: z.number().int().positive(),
  locationId: z.number().int().positive(),
  category: z.string().trim().min(1).max(20),
  paidByUserId: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  // 財務 v2：從哪個資金帳戶付（不填＝付款人的預設帳戶）；isAdvance＝付款人自己先墊（記應付業主款）。
  moneyAccountId: z.number().int().positive().optional(),
  isAdvance: z.boolean().optional(),
});


export async function createExpense(
  classroomId: number,
  userId: number,
  body: z.infer<typeof expenseSchema>
) {
  const location = await prisma.location.findFirst({ where: { id: body.locationId, classroomId } });
  if (!location) throw new ApiError(404, "NOT_FOUND", "Location not found");
  if (body.isAdvance) {
    // 代墊：誰都可以墊（不用是保管人），只要是這間教室的成員。
    const m = await prisma.membership.findUnique({ where: { userId_classroomId: { userId: body.paidByUserId, classroomId } } });
    if (!m) throw new ApiError(400, "INVALID_USER", "Not a member of this classroom");
  } else {
    await assertCustodian(body.paidByUserId, classroomId);
  }
  if (body.moneyAccountId !== undefined && !body.isAdvance) {
    const ma = await prisma.moneyAccount.findFirst({ where: { id: body.moneyAccountId, classroomId, archivedAt: null } });
    if (!ma) throw new ApiError(400, "INVALID_MONEY_ACCOUNT", "Money account not found");
  }
  const c = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { financeLockDate: true } });
  if (c?.financeLockDate && body.date <= c.financeLockDate.toISOString().slice(0, 10)) {
    throw new ApiError(409, "PERIOD_LOCKED", "The ledger is locked for this date");
  }
  const created = await prisma.financeExpense.create({
    data: {
      classroomId,
      date: dateOf(body.date),
      amount: body.amount,
      locationId: body.locationId,
      category: body.category,
      paidByUserId: body.paidByUserId,
      moneyAccountId: body.isAdvance ? null : (body.moneyAccountId ?? null),
      isAdvance: !!body.isAdvance,
      note: body.note ?? null,
      createdById: userId,
    },
    select: expenseSelect,
  });
  await syncLedger(classroomId);
  return created;
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
  await assertCustodian(paidByUserId, classroomId);
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
