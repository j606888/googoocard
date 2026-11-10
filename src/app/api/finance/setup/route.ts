import { apiRoute } from "@/lib/apiRoute";
import { loadSetup } from "@/service/finance/setup";
import { conversionDateParam } from "@/service/finance/strayReceivers";

// 任何成員可讀；沒開財務 → 404 FINANCE_DISABLED。
// ?conversionDate=YYYY-MM-DD：精靈草稿的轉換日，收款人整理照這天判斷。
export const GET = apiRoute(async ({ request, classroomId }) => {
  const { items, lessons } = await loadSetup(classroomId, conversionDateParam(request));
  return { items, lessons, complete: items.every((i) => i.done) };
});
