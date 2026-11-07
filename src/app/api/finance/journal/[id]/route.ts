import { apiRoute, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { getEntry } from "@/service/ledger/records";

export const GET = apiRoute<{ id: string }>(async ({ params, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return getEntry(classroomId, parseId(params.id));
});
