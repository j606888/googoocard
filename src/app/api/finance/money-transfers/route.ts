import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { createMoneyTransfer, transferSchema } from "@/service/ledger/payouts";

// 資金帳戶之間轉帳（可以結算的人，或轉出帳戶的保管人）。pending: true＝先記成待轉。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return createMoneyTransfer(classroomId, userId, await parseBody(request, transferSchema));
});
