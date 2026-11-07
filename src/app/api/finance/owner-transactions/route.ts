import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { createOwnerTxn, ownerTxnSchema } from "@/service/ledger/records";

// 業主投入／提取／宣告分紅（可以結算的人）。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return createOwnerTxn(classroomId, userId, await parseBody(request, ownerTxnSchema));
});
