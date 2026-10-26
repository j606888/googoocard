import { apiRoute, parseBody } from "@/lib/apiRoute";
import { tierSchema } from "@/domains/curriculum/schemas";
import { createTier, styleScope } from "@/service/curriculum/skillTree";

/** 新增第 N 轉（最多 10 個）。 */
export const POST = apiRoute<{ danceStyleId: string }>(
  async ({ request, params, classroomId }) => {
    const scope = await styleScope(params.danceStyleId, classroomId);
    const { label } = await parseBody(request, tierSchema);
    return createTier(scope, label);
  },
  { permission: "curriculum.edit" }
);
