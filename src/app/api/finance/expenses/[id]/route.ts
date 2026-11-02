import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertFinance } from "@/service/finance/access";
import { assertVoidable } from "@/service/finance/settlement";

// 作廢而不是刪除：保留 voidedAt。
export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const id = parseId(params.id);
  const row = await prisma.financeExpense.findFirst({ where: { id, classroomId } });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Expense not found");
  if (!row.voidedAt) await assertVoidable(classroomId, { date: row.date, kind: "expenses", id });
  return prisma.financeExpense.update({
    where: { id },
    data: row.voidedAt ? {} : { voidedAt: new Date() },
    select: { id: true, voidedAt: true },
  });
});
