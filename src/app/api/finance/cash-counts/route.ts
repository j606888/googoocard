import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { cashCountSchema, createCashCount } from "@/service/ledger/records";

// 現金盤點（可以結算的人，或這個帳戶的保管人）。差額記現金短溢。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return createCashCount(classroomId, userId, await parseBody(request, cashCountSchema));
});
