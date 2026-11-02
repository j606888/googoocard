import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertFinance } from "@/service/finance/access";

const schema = z.object({ fundOpening: z.number().int() });

// 「確認期初」：同時寫入公積金期初與確認時間（PATCH 只改數字、不算確認）。
export const POST = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const id = parseId(params.id);
  const { fundOpening } = await parseBody(request, schema);
  const current = await prisma.location.findFirst({ where: { id, classroomId }, select: { id: true } });
  if (!current) throw new ApiError(404, "NOT_FOUND", "Location not found");
  return prisma.location.update({
    where: { id },
    data: { fundOpening, fundOpeningConfirmedAt: new Date() },
    select: { id: true, fundOpening: true, fundOpeningConfirmedAt: true },
  });
});
