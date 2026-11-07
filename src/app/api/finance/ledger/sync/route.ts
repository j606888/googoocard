import { apiRoute } from "@/lib/apiRoute";
import { assertCanSettle, assertFinanceEnabled } from "@/service/finance/access";
import { syncLedger } from "@/service/ledger/sync";

// 財務 v2：把營運資料過帳到總帳（冪等，只記差額）。docs/finance-v2/03 §3。
export const POST = apiRoute(async ({ userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  await assertCanSettle(userId, classroomId);
  return syncLedger(classroomId);
});
