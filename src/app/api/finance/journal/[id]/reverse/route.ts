import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { reverseEntry, reverseSchema } from "@/service/ledger/records";

// 沖銷手動分錄（不能刪改）。
export const POST = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return reverseEntry(classroomId, userId, parseId(params.id), await parseBody(request, reverseSchema));
});
