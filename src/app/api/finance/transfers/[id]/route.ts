import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { assertVoidable } from "@/service/finance/settlement";

// 作廢而不是刪除：保留 voidedAt。可以結算的人什麼都能取消；付款人只能取消自己按的那筆。
export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const id = parseId(params.id);
  const row = await prisma.financeTransfer.findFirst({ where: { id, classroomId } });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Transfer not found");
  const membership = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { canSettle: true },
  });
  if (!membership?.canSettle && !(row.fromUserId === userId && row.createdById === userId)) {
    throw new ApiError(403, "NOT_PAYER", "Only the payer who marked it (or a settler) can cancel it");
  }
  if (!row.voidedAt) await assertVoidable(classroomId, { date: row.date, kind: "transfers", id });
  return prisma.financeTransfer.update({
    where: { id },
    data: row.voidedAt ? {} : { voidedAt: new Date() },
    select: { id: true, voidedAt: true },
  });
});
