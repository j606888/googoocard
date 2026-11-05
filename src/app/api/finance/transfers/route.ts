import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { createTransfer, monthFilter, transferSchema, transferSelect } from "@/service/finance/cash";
import { assertCanRecordTransfer } from "@/service/finance/settlement";

export const GET = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const transfers = await prisma.financeTransfer.findMany({
    where: { classroomId, voidedAt: null, ...monthFilter(request) },
    select: transferSelect,
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  return { transfers };
});

// POST：可以結算的人記任何轉帳；付款人自己只能記結算單上自己那筆的「已完成轉帳」（spec「月結」）。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, transferSchema);
  await assertCanRecordTransfer(userId, classroomId, body);
  return createTransfer(classroomId, userId, body);
});
