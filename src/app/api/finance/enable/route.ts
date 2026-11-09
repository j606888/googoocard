import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { enableFinance } from "@/service/finance/setup";

// 不再問上線日：舊版前端送來的 launchDate 直接忽略（z.object 會丟掉沒定義的欄位）。
const schema = z.object({
  legacyCustodianUserId: z.number().int().positive(),
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, schema);
  const r = await enableFinance({ classroomId, userId, ...body });
  return { enabled: true, enabledAt: r.enabledAt };
});
