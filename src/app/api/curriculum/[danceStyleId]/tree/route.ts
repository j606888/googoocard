import { apiRoute, parseBody } from "@/lib/apiRoute";
import { createTreeSchema } from "@/domains/curriculum/schemas";
import { createTree, loadSkillTree, styleScope } from "@/service/curriculum/skillTree";

type Params = { danceStyleId: string };

export const GET = apiRoute<Params>(
  async ({ params, classroomId }) => loadSkillTree(await styleScope(params.danceStyleId, classroomId)),
  { permission: "curriculum.view" }
);

/** 建立技能樹：預設五個分類＋一轉到三轉，或完全空白（一個分類、一個等級）。已有樹 → 409。 */
export const POST = apiRoute<Params>(
  async ({ request, params, classroomId }) => {
    const scope = await styleScope(params.danceStyleId, classroomId);
    const { template } = await parseBody(request, createTreeSchema);
    await createTree(scope, template);
    return loadSkillTree(scope);
  },
  { permission: "curriculum.edit" }
);
