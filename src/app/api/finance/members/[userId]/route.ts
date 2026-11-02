import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertFinance } from "@/service/finance/access";

const schema = z.object({ isFinance: z.boolean() });

export const PATCH = apiRoute<{ userId: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const targetId = parseId(params.userId, "userId");
  const { isFinance } = await parseBody(request, schema);

  await prisma.$transaction(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { userId_classroomId: { userId: targetId, classroomId } },
      select: { id: true, isFinance: true },
    });
    if (!target) throw new ApiError(404, "MEMBER_NOT_FOUND", "Member not found");
    if (!isFinance && target.isFinance) {
      const others = await tx.membership.count({
        where: { classroomId, isFinance: true, NOT: { id: target.id } },
      });
      if (others === 0) {
        throw new ApiError(409, "LAST_FINANCE", "Cannot remove the last finance member");
      }
    }
    await tx.membership.update({ where: { id: target.id }, data: { isFinance } });
  });
  return { userId: targetId, isFinance };
});
