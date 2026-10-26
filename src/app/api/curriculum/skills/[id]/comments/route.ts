import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { commentSchema } from "@/domains/curriculum/schemas";
import { postComment } from "@/service/curriculum/talk";

/** 留言（只要看得到技能樹就能留言）。回覆的回覆會攤平到同一串。 */
export const POST = apiRoute<{ id: string }>(
  async ({ request, params, classroomId, userId }) => {
    const { text, parentId } = await parseBody(request, commentSchema);
    return postComment(parseId(params.id, "skill id"), classroomId, userId, text, parentId);
  },
  { permission: "curriculum.view" }
);
