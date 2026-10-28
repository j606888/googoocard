import { apiRoute } from "@/lib/apiRoute";
import { styleScope } from "@/service/curriculum/skillTree";
import { loadTalk } from "@/service/curriculum/talk";

/** 這個舞種所有技能（含待定、已封存）的留言，加上我的已讀與被 @。 */
export const GET = apiRoute<{ danceStyleId: string }>(
  async ({ params, classroomId, userId }) => {
    const { danceStyleId } = await styleScope(params.danceStyleId, classroomId);
    return loadTalk(classroomId, danceStyleId, userId);
  },
  { permission: "curriculum.view" }
);
