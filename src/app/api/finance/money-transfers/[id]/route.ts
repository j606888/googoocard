import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { deleteMoneyTransfer } from "@/service/ledger/payouts";

export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return deleteMoneyTransfer(classroomId, userId, parseId(params.id));
});
