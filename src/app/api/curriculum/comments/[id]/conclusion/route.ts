import { apiRoute, parseId } from "@/lib/apiRoute";
import { clearConclusion, setConclusion } from "@/service/curriculum/talk";

type Params = { id: string };

/** 標成結論：每個技能最多一則，其他的會被取消。 */
export const PUT = apiRoute<Params>(
  async ({ params, classroomId, userId }) => {
    await setConclusion(parseId(params.id, "comment id"), classroomId, userId);
    return { success: true };
  },
  { permission: "curriculum.view" }
);

export const DELETE = apiRoute<Params>(
  async ({ params, classroomId }) => {
    await clearConclusion(parseId(params.id, "comment id"), classroomId);
    return { success: true };
  },
  { permission: "curriculum.view" }
);
