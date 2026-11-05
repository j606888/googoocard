import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertCanSettle } from "@/service/finance/access";
import { assertCustodian } from "@/service/finance/config";

const patchSchema = z.object({
  keeperUserId: z.number().int().positive().nullable().optional(),
  expiryTo: z.enum(["FUND", "USER"]).optional(),
  expiryUserId: z.number().int().positive().nullable().optional(),
  fundOpening: z.number().int().optional(),
});

// 不動 fundOpeningConfirmedAt（確認期初是另一個按鈕）。
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const id = parseId(params.id);
  const body = await parseBody(request, patchSchema);
  const current = await prisma.location.findFirst({ where: { id, classroomId } });
  if (!current) throw new ApiError(404, "NOT_FOUND", "Location not found");

  if (body.keeperUserId != null) await assertCustodian(body.keeperUserId, classroomId);
  if (body.expiryUserId != null) await assertCustodian(body.expiryUserId, classroomId);

  const expiryTo = body.expiryTo ?? current.expiryTo;
  const expiryUserId = body.expiryUserId !== undefined ? body.expiryUserId : current.expiryUserId;
  if (expiryTo === "USER" && expiryUserId == null) {
    throw new ApiError(400, "EXPIRY_USER_REQUIRED", "expiryUserId is required when expiryTo is USER");
  }

  return prisma.location.update({
    where: { id },
    data: {
      ...(body.keeperUserId !== undefined ? { keeperUserId: body.keeperUserId } : {}),
      ...(body.expiryTo !== undefined ? { expiryTo: body.expiryTo } : {}),
      ...(body.expiryUserId !== undefined ? { expiryUserId: body.expiryUserId } : {}),
      ...(body.fundOpening !== undefined ? { fundOpening: body.fundOpening } : {}),
    },
    select: {
      id: true,
      name: true,
      keeperUserId: true,
      expiryTo: true,
      expiryUserId: true,
      fundOpening: true,
      fundOpeningConfirmedAt: true,
    },
  });
});
