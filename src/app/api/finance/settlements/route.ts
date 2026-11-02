import { apiRoute } from "@/lib/apiRoute";
import { listSettlementMonths } from "@/service/finance/settlement";

// GET：上線月份到這個月的結算狀態＋最早沒鎖的月份。任何成員可讀。
export const GET = apiRoute(async ({ classroomId }) => listSettlementMonths(classroomId));
