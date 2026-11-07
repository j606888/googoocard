import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { signOff, signoffSchema } from "@/service/ledger/close";

// 分部負責人（或 owner）簽核看過損益表。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return signOff(classroomId, userId, await parseBody(request, signoffSchema));
});
