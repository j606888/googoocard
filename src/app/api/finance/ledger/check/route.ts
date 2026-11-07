import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { syncLedger } from "@/service/ledger/sync";
import { checkLedger } from "@/service/ledger/check";

// 財務 v2：帳本健康檢查（先過帳再檢查）。任何成員可讀（財務全部透明）。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const sync = await syncLedger(classroomId);
  const problems = await checkLedger(classroomId);
  return { ok: problems.length === 0, problems, sync };
});
