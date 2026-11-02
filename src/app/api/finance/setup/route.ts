import { apiRoute } from "@/lib/apiRoute";
import { setupChecklist } from "@/service/finance/setup";

// 任何成員可讀；沒開財務 → 404 FINANCE_DISABLED。
export const GET = apiRoute(async ({ classroomId }) => {
  const items = await setupChecklist(classroomId);
  return { items, complete: items.every((i) => i.done) };
});
