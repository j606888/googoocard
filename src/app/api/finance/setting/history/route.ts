import { apiRoute } from "@/lib/apiRoute";
import { settingHistory } from "@/service/finance/entries";

export const GET = apiRoute(async ({ classroomId }) => settingHistory(classroomId), { permission: "finance.view" });
