import { apiRoute, parseId } from "@/lib/apiRoute";
import { restoreSkill } from "@/service/curriculum/skillTree";

export const POST = apiRoute<{ id: string }>(
  async ({ params, classroomId, userId }) => {
    await restoreSkill(parseId(params.id, "skill id"), classroomId, userId);
    return { success: true };
  },
  { permission: "curriculum.edit" }
);
