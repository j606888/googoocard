import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { ApiError, badRequest, notFound } from "@/lib/apiError";
import { isAdminRole } from "@/lib/roles";
import { parseTaipeiDateRange } from "@/lib/taipei-date";

const schema = z.object({
  keeperUserId: z.number().int().nullable().optional(),
  /** 轉換日 YYYY-MM-DD（台北時間那天 00:00 起算）；null = 這個分部不算錢。 */
  financeStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** 分部負責人與轉換日：只有管理員能改。 */
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, classroomId, role }) => {
  if (!isAdminRole(role)) throw new ApiError(403, "FINANCE_FORBIDDEN", "Only admins can change branch finance settings");
  const id = parseId(params.id, "location id");
  const body = await parseBody(request, schema);
  const location = await prisma.location.findFirst({ where: { id, classroomId }, select: { id: true } });
  if (!location) throw notFound("Location");

  if (body.keeperUserId != null) {
    const member = await prisma.membership.findFirst({ where: { classroomId, userId: body.keeperUserId } });
    if (!member) throw badRequest("KEEPER_NOT_MEMBER", "Keeper must be a member of this classroom");
  }

  return prisma.location.update({
    where: { id },
    data: {
      ...(body.keeperUserId !== undefined ? { keeperUserId: body.keeperUserId } : {}),
      ...(body.financeStartDate !== undefined
        ? { financeStartAt: body.financeStartDate ? parseTaipeiDateRange(body.financeStartDate).start : null }
        : {}),
    },
    select: { id: true, name: true, archivedAt: true, keeperUserId: true, financeStartAt: true },
  });
});
