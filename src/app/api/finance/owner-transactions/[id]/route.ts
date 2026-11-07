import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { voidOwnerTxn } from "@/service/ledger/records";

export const DELETE = apiRoute<{ id: string }>(async ({ params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return voidOwnerTxn(classroomId, userId, parseId(params.id));
});
