import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertCanSettle } from "@/service/finance/access";
import { assertCustodian } from "@/service/finance/config";
import { ensureLedgerSetup } from "@/service/ledger/setup";

const patchSchema = z.object({
  keeperUserId: z.number().int().positive().nullable().optional(),
  expiryTo: z.enum(["FUND", "USER"]).optional(),
  expiryUserId: z.number().int().positive().nullable().optional(),
});

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

  const updated = await prisma.location.update({
    where: { id },
    data: {
      ...(body.keeperUserId !== undefined ? { keeperUserId: body.keeperUserId } : {}),
      ...(body.expiryTo !== undefined ? { expiryTo: body.expiryTo } : {}),
      ...(body.expiryUserId !== undefined ? { expiryUserId: body.expiryUserId } : {}),
    },
    select: {
      id: true,
      name: true,
      keeperUserId: true,
      expiryTo: true,
      expiryUserId: true,
    },
  });
  // 新的分部負責人 → 補他的預設資金帳戶（docs/finance-v2/06 P1）。
  if (body.keeperUserId != null) await ensureLedgerSetup(classroomId);
  return updated;
});
