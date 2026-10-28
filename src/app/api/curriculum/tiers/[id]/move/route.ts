import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { moveSchema } from "@/domains/curriculum/schemas";
import { findTierInClassroom, moveStructure } from "@/service/curriculum/skillTree";

export const POST = apiRoute<{ id: string }>(
  async ({ request, params, classroomId }) => {
    const tier = await findTierInClassroom(parseId(params.id, "tier id"), classroomId);
    const { dir } = await parseBody(request, moveSchema);
    await moveStructure("tier", tier.id, { classroomId, danceStyleId: tier.danceStyleId }, dir);
    return { success: true };
  },
  { permission: "curriculum.edit" }
);
