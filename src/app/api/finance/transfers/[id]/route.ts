import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertCanSettle } from "@/service/finance/access";
import { assertVoidable } from "@/service/finance/settlement";

// 作廢而不是刪除：保留 voidedAt。
export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const id = parseId(params.id);
  const row = await prisma.financeTransfer.findFirst({ where: { id, classroomId } });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Transfer not found");
  if (!row.voidedAt) await assertVoidable(classroomId, { date: row.date, kind: "transfers", id });
  return prisma.financeTransfer.update({
    where: { id },
    data: row.voidedAt ? {} : { voidedAt: new Date() },
    select: { id: true, voidedAt: true },
  });
});
