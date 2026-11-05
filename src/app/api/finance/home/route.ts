import { apiRoute } from "@/lib/apiRoute";
import { getFinanceHome } from "@/service/finance/home";

// GET：財務首頁「要處理的事」＋分部清單與我負責的分部。任何成員可讀；財務沒開 → 404 FINANCE_DISABLED。
export const GET = apiRoute(async ({ userId, classroomId }) => getFinanceHome(classroomId, userId));
