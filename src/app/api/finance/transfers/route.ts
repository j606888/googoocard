import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { parseTaipeiDateRange } from "@/lib/taipei-date";
import { assertCanManageFinance } from "@/service/finance/access";

/** 記一筆分部之間的轉帳（把往來轉平）。 */
export const POST = apiRoute(async ({ request, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const body = await parseBody(
    request,
    z.object({
      fromLocationId: z.number().int(),
      toLocationId: z.number().int(),
      amount: z.number().int().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().trim().max(200).nullable().optional(),
    })
  );
  if (body.fromLocationId === body.toLocationId) throw badRequest("TRANSFER_SAME_BRANCH", "Pick two different branches");
  const count = await prisma.location.count({ where: { classroomId, id: { in: [body.fromLocationId, body.toLocationId] } } });
  if (count !== 2) throw badRequest("TRANSFER_BAD_BRANCH", "Branch not in this classroom");
  return prisma.branchTransfer.create({
    data: {
      classroomId,
      fromLocationId: body.fromLocationId,
      toLocationId: body.toLocationId,
      amount: body.amount,
      at: body.date ? parseTaipeiDateRange(body.date).start : new Date(),
      note: body.note || null,
      createdById: userId,
    },
  });
});
