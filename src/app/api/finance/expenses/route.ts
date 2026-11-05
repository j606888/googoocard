import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertCanSettle, assertFinanceEnabled } from "@/service/finance/access";
import { createExpense, expenseSchema, expenseSelect, monthFilter } from "@/service/finance/cash";

export const GET = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const expenses = await prisma.financeExpense.findMany({
    where: { classroomId, voidedAt: null, ...monthFilter(request) },
    select: expenseSelect,
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  return { expenses };
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const body = await parseBody(request, expenseSchema);
  return createExpense(classroomId, userId, body);
});
