import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { openingParamsSchema, previewOpening } from "@/service/ledger/opening";
import { openingDetail } from "@/service/ledger/openingDetail";

// 試算某一天開帳的期初資產負債表，不寫入（04 §6）。任何成員可用。
// `cards`／`packs`：給精靈看的明細（期初現金背後是哪幾張卡、次數包剩幾次），不影響分錄。
export const POST = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const params = await parseBody(request, openingParamsSchema);
  // 依序跑：兩邊都會 ensureLedgerSetup，同時跑可能重複建科目。
  const preview = await previewOpening(classroomId, params);
  const detail = await openingDetail(classroomId, params.conversionDate);
  return { ...preview, lines: undefined, cards: detail.cards, packs: detail.packs };
});
