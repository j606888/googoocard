import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertCanSettle } from "@/service/finance/access";

const schema = z
  .object({ isCustodian: z.boolean().optional(), canSettle: z.boolean().optional() })
  .refine((b) => b.isCustodian !== undefined || b.canSettle !== undefined, {
    message: "isCustodian or canSettle is required",
  });

// 兩個旗標各自守門：教室至少要留一位保管人、一位可以結算的人。
const LAST: Record<"isCustodian" | "canSettle", { code: string; message: string }> = {
  isCustodian: { code: "LAST_CUSTODIAN", message: "Cannot remove the last custodian" },
  canSettle: { code: "LAST_SETTLER", message: "Cannot remove the last member who can settle" },
};

export const PATCH = apiRoute<{ userId: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const targetId = parseId(params.userId, "userId");
  const body = await parseBody(request, schema);

  return prisma.$transaction(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { userId_classroomId: { userId: targetId, classroomId } },
      select: { id: true, isCustodian: true, canSettle: true },
    });
    if (!target) throw new ApiError(404, "MEMBER_NOT_FOUND", "Member not found");
    for (const flag of ["isCustodian", "canSettle"] as const) {
      if (body[flag] !== false || !target[flag]) continue;
      const others = await tx.membership.count({
        where: { classroomId, [flag]: true, NOT: { id: target.id } },
      });
      if (others === 0) throw new ApiError(409, LAST[flag].code, LAST[flag].message);
    }
    const updated = await tx.membership.update({
      where: { id: target.id },
      data: {
        ...(body.isCustodian !== undefined ? { isCustodian: body.isCustodian } : {}),
        ...(body.canSettle !== undefined ? { canSettle: body.canSettle } : {}),
      },
      select: { isCustodian: true, canSettle: true },
    });
    return { userId: targetId, ...updated };
  });
});
