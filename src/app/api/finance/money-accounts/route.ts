import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertCanSettle, assertFinanceEnabled } from "@/service/finance/access";
import { assertCustodian } from "@/service/finance/config";
import { createMoneyAccount } from "@/service/ledger/setup";
import { listMoneyAccounts } from "@/service/ledger/records";

// 資金帳戶（docs/finance-v2/02 §1.3）。任何成員可讀；新增只有可以結算的人。
// 每個帳戶帶帳上餘額（分）與最後一次盤點。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return listMoneyAccounts(classroomId);
});

const createSchema = z.object({
  holderUserId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  name: z.string().trim().min(1).max(40).optional(),
  kind: z.enum(["CASH", "BANK", "EWALLET"]).default("CASH"),
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  await assertCanSettle(userId, classroomId);
  const body = await parseBody(request, createSchema);
  await assertCustodian(body.holderUserId, classroomId);
  const loc = await prisma.location.findFirst({ where: { id: body.locationId, classroomId, archivedAt: null } });
  if (!loc) throw new ApiError(400, "INVALID_LOCATION", "Location not found");
  return createMoneyAccount(prisma, classroomId, body);
});
