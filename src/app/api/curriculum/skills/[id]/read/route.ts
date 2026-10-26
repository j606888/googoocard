import { apiRoute, parseId } from "@/lib/apiRoute";
import { markRead } from "@/service/curriculum/talk";

/** 打開技能的討論：記已讀、把我在這串的 @ 標成已看。 */
export const POST = apiRoute<{ id: string }>(
  async ({ params, classroomId, userId }) => {
    await markRead(parseId(params.id, "skill id"), classroomId, userId);
    return { success: true };
  },
  { permission: "curriculum.view" }
);
