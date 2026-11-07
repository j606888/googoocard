import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { deletePayout, updatePayout, updatePayoutSchema } from "@/service/ledger/payouts";

// 還沒付：改付款帳戶／實付；刪除（已付的會作廢並記更正）。
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return updatePayout(classroomId, userId, parseId(params.id), await parseBody(request, updatePayoutSchema));
});

export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return deletePayout(classroomId, userId, parseId(params.id));
});
