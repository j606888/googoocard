import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { editCommentSchema } from "@/domains/curriculum/schemas";
import { deleteComment, editComment } from "@/service/curriculum/talk";

type Params = { id: string };

/** 只有作者能編輯。 */
export const PATCH = apiRoute<Params>(
  async ({ request, params, classroomId, userId }) => {
    const { text } = await parseBody(request, editCommentSchema);
    return editComment(parseId(params.id, "comment id"), classroomId, userId, text);
  },
  { permission: "curriculum.view" }
);

/** 作者本人，或能管理成員的人（管理員）。 */
export const DELETE = apiRoute<Params>(
  async ({ params, classroomId, userId, permissions }) => {
    await deleteComment(parseId(params.id, "comment id"), classroomId, userId, permissions.has("members.manage"));
    return { success: true };
  },
  { permission: "curriculum.view" }
);
