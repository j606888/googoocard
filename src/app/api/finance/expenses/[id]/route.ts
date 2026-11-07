import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertCanSettle } from "@/service/finance/access";
import { syncLedger } from "@/service/ledger/sync";

// 作廢而不是刪除：保留 voidedAt。鎖帳期間的作廢，帳本會把更正記在鎖帳日隔天。
export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const id = parseId(params.id);
  const row = await prisma.financeExpense.findFirst({ where: { id, classroomId } });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Expense not found");
  const updated = await prisma.financeExpense.update({
    where: { id },
    data: row.voidedAt ? {} : { voidedAt: new Date() },
    select: { id: true, voidedAt: true },
  });
  await syncLedger(classroomId);
  return updated;
});
