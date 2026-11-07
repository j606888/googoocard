import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { voidCashCount } from "@/service/ledger/records";

export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return voidCashCount(classroomId, userId, parseId(params.id));
});
