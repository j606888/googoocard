import { z } from "zod";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { markTransferDone } from "@/service/ledger/payouts";
import { ymd } from "@/service/ledger/guard";

export const POST = apiRoute<{ id: string }>(async ({ request, params, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return markTransferDone(classroomId, userId, parseId(params.id), await parseBody(request, z.object({ date: ymd.optional() })));
});
