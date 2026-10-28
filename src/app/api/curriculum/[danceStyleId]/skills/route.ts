import { apiRoute, parseBody } from "@/lib/apiRoute";
import { createSkillSchema } from "@/domains/curriculum/schemas";
import { createSkill, styleScope } from "@/service/curriculum/skillTree";

/** 新增技能：有 categoryId 就放進樹（要等級），沒有就進待定區。同名 → 409。 */
export const POST = apiRoute<{ danceStyleId: string }>(
  async ({ request, params, classroomId, userId }) => {
    const scope = await styleScope(params.danceStyleId, classroomId);
    return createSkill(scope, await parseBody(request, createSkillSchema), userId);
  },
  { permission: "curriculum.edit" }
);
