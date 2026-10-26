import { apiRoute, parseBody } from "@/lib/apiRoute";
import { addDraftsSchema } from "@/domains/curriculum/schemas";
import { addDrafts, styleScope } from "@/service/curriculum/skillTree";

/** 待定區：一次貼多行，一行一個名字。已經有的名字跳過並回報 `skipped`。 */
export const POST = apiRoute<{ danceStyleId: string }>(
  async ({ request, params, classroomId, userId }) => {
    const scope = await styleScope(params.danceStyleId, classroomId);
    const { text } = await parseBody(request, addDraftsSchema);
    return addDrafts(scope, text, userId);
  },
  { permission: "curriculum.edit" }
);
