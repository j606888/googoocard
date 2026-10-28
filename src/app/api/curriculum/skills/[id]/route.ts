import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { patchSkillSchema } from "@/domains/curriculum/schemas";
import { patchSkill, removeSkill } from "@/service/curriculum/skillTree";

type Params = { id: string };

/** 改名、描述、換分類／等級（待定卡給分類＝放進樹），每項都寫修改紀錄。 */
export const PATCH = apiRoute<Params>(
  async ({ request, params, classroomId, userId }) =>
    patchSkill(parseId(params.id, "skill id"), classroomId, await parseBody(request, patchSkillSchema), userId),
  { permission: "curriculum.edit" }
);

/** 樹上的技能封存；待定卡連同留言刪除。 */
export const DELETE = apiRoute<Params>(
  async ({ params, classroomId, userId }) => removeSkill(parseId(params.id, "skill id"), classroomId, userId),
  { permission: "curriculum.edit" }
);
