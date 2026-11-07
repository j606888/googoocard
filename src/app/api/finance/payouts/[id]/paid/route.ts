import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { markPaidSchema, markPayoutPaid } from "@/service/ledger/payouts";

// 付款人按「已付款」（可以結算的人，或付款資金帳戶的保管人）。
export const POST = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return markPayoutPaid(classroomId, userId, parseId(params.id), await parseBody(request, markPaidSchema));
});
