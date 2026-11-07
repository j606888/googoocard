import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { getOpening, openLedger, openingParamsSchema } from "@/service/ledger/opening";

// 財務 v2 開帳（docs/finance-v2/04）。任何成員可讀；開帳／重開只有 owner、鎖帳前。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return getOpening(classroomId);
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const params = await parseBody(request, openingParamsSchema);
  return openLedger(classroomId, userId, params);
});
