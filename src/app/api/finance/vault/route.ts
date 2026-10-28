import { apiRoute } from "@/lib/apiRoute";
import { getVaultLedger } from "@/service/finance/money";

export const GET = apiRoute(async ({ classroomId }) => getVaultLedger(classroomId), { permission: "finance.view" });
