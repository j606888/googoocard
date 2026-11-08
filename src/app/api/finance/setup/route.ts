import { apiRoute } from "@/lib/apiRoute";
import { loadSetup } from "@/service/finance/setup";

// 任何成員可讀；沒開財務 → 404 FINANCE_DISABLED。
export const GET = apiRoute(async ({ classroomId }) => {
  const { items, lessons } = await loadSetup(classroomId);
  return { items, lessons, complete: items.every((i) => i.done) };
});
