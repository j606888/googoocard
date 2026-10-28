import { apiRoute } from "@/lib/apiRoute";
import { getOverview } from "@/service/finance/money";

export const GET = apiRoute(async ({ classroomId }) => getOverview(classroomId), { permission: "finance.view" });
