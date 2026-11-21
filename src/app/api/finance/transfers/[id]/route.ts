import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { assertCanManageFinance } from "@/service/finance/access";

/** 作廢一筆轉帳（記錯了）。 */
export const DELETE = apiRoute<{ id: string }>(async ({ params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const id = parseId(params.id, "transfer id");
  const t = await prisma.branchTransfer.findFirst({ where: { id, classroomId, voidedAt: null } });
  if (!t) throw notFound("Transfer");
  return prisma.branchTransfer.update({ where: { id }, data: { voidedAt: new Date() } });
});
