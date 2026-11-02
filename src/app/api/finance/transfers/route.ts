import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinance, assertFinanceEnabled } from "@/service/finance/access";
import { createTransfer, monthFilter, transferSchema, transferSelect } from "@/service/finance/cash";

export const GET = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const transfers = await prisma.financeTransfer.findMany({
    where: { classroomId, voidedAt: null, ...monthFilter(request) },
    select: transferSelect,
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  return { transfers };
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const body = await parseBody(request, transferSchema);
  return createTransfer(classroomId, userId, body);
});
