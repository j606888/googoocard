import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { openingParamsSchema, previewOpening } from "@/service/ledger/opening";

// 試算某一天開帳的期初資產負債表，不寫入（04 §6）。任何成員可用。
export const POST = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const params = await parseBody(request, openingParamsSchema);
  const preview = await previewOpening(classroomId, params);
  return { ...preview, lines: undefined };
});
