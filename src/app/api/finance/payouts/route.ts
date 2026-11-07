import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { createPayoutRun, createRunSchema, listPayoutRuns } from "@/service/ledger/payouts";

// 付款批次（docs/finance-v2/05 §3.8）。金額單位「分」。任何成員可讀；建批次＝可以結算的人。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return listPayoutRuns(classroomId);
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return createPayoutRun(classroomId, userId, await parseBody(request, createRunSchema));
});
