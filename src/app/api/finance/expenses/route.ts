import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertCanRecordPayment, assertFinanceEnabled } from "@/service/finance/access";
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

// 可以結算的人記任何人付的；保管人只能記自己付的。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, expenseSchema);
  await assertCanRecordPayment(userId, classroomId, body.paidByUserId);
  return createExpense(classroomId, userId, body);
});
