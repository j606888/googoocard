import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { assertCanSettle } from "@/service/finance/access";
import { assertCustodian } from "@/service/finance/config";

// 任何成員可讀；沒開財務時 enabled=false。
export const GET = apiRoute(async ({ classroomId }) => {
  const c = await prisma.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    select: { financeEnabledAt: true, financeRoundTo: true, legacyCustodianUserId: true },
  });
  const memberships = await prisma.membership.findMany({
    where: { classroomId },
    select: { userId: true, isCustodian: true, canSettle: true, user: { select: { name: true } } },
    orderBy: { id: "asc" },
  });
  return {
    enabled: !!c.financeEnabledAt,
    launchDate: c.financeEnabledAt ? toTaipeiDateKey(c.financeEnabledAt) : null,
    roundTo: c.financeRoundTo,
    legacyCustodianUserId: c.legacyCustodianUserId,
    members: memberships.map((m) => ({ userId: m.userId, name: m.user.name, isCustodian: m.isCustodian, canSettle: m.canSettle })),
  };
});

const patchSchema = z.object({
  roundTo: z.union([z.literal(1), z.literal(10), z.literal(100)]).optional(),
  legacyCustodianUserId: z.number().int().positive().optional(),
});

export const PATCH = apiRoute(async ({ request, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const body = await parseBody(request, patchSchema);
  if (body.legacyCustodianUserId !== undefined) {
    // 舊卡的錢在他手上 → 必須是保管人（400 NOT_FINANCE_MEMBER）。
    await assertCustodian(body.legacyCustodianUserId, classroomId);
  }
  const c = await prisma.classroom.update({
    where: { id: classroomId },
    data: {
      ...(body.roundTo !== undefined ? { financeRoundTo: body.roundTo } : {}),
      ...(body.legacyCustodianUserId !== undefined
        ? { legacyCustodianUserId: body.legacyCustodianUserId }
        : {}),
    },
    select: { financeRoundTo: true, legacyCustodianUserId: true },
  });
  return { roundTo: c.financeRoundTo, legacyCustodianUserId: c.legacyCustodianUserId };
});
