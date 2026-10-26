import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { reactionSchema } from "@/domains/curriculum/schemas";
import { react } from "@/service/curriculum/talk";

/** 按表情；同一個再按一次＝取消，換一個＝覆蓋。 */
export const PUT = apiRoute<{ id: string }>(
  async ({ request, params, classroomId, userId }) => {
    const { kind } = await parseBody(request, reactionSchema);
    return react(parseId(params.id, "comment id"), classroomId, userId, kind);
  },
  { permission: "curriculum.view" }
);
