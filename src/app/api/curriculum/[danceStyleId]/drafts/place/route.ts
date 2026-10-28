import { apiRoute, parseBody } from "@/lib/apiRoute";
import { placeDraftsSchema } from "@/domains/curriculum/schemas";
import { placeDrafts, styleScope } from "@/service/curriculum/skillTree";

/** 勾選的待定卡放進某分類／等級。樹上已有同名的跳過並回報。 */
export const POST = apiRoute<{ danceStyleId: string }>(
  async ({ request, params, classroomId, userId }) => {
    const scope = await styleScope(params.danceStyleId, classroomId);
    const { ids, categoryId, tierId } = await parseBody(request, placeDraftsSchema);
    return placeDrafts(scope, ids, categoryId, tierId, userId);
  },
  { permission: "curriculum.edit" }
);
