import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertFinance } from "@/service/finance/access";

// 作廢而不是刪除：保留 voidedAt。
export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const id = parseId(params.id);
  const pack = await prisma.venuePack.findFirst({ where: { id, classroomId } });
  if (!pack) throw new ApiError(404, "NOT_FOUND", "Pack not found");
  return prisma.venuePack.update({
    where: { id },
    data: pack.voidedAt ? {} : { voidedAt: new Date() },
    select: { id: true, voidedAt: true },
  });
});
