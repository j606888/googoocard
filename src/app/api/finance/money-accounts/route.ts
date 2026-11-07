import { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertCanSettle, assertFinanceEnabled } from "@/service/finance/access";
import { assertCustodian } from "@/service/finance/config";
import { createMoneyAccount } from "@/service/ledger/setup";

// 資金帳戶（docs/finance-v2/02 §1.3）。任何成員可讀；新增只有可以結算的人。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const accounts = await prisma.moneyAccount.findMany({
    where: { classroomId },
    select: { id: true, name: true, kind: true, holderUserId: true, locationId: true, isDefault: true, archivedAt: true, account: { select: { code: true } } },
    orderBy: [{ holderUserId: "asc" }, { id: "asc" }],
  });
  return { accounts: accounts.map(({ account, ...a }) => ({ ...a, code: account.code })) };
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
