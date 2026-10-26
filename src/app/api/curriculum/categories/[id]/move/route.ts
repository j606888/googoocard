import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { moveSchema } from "@/domains/curriculum/schemas";
import { findCategoryInClassroom, moveStructure } from "@/service/curriculum/skillTree";

export const POST = apiRoute<{ id: string }>(
  async ({ request, params, classroomId }) => {
    const category = await findCategoryInClassroom(parseId(params.id, "category id"), classroomId);
    const { dir } = await parseBody(request, moveSchema);
    await moveStructure("category", category.id, { classroomId, danceStyleId: category.danceStyleId }, dir);
    return { success: true };
  },
  { permission: "curriculum.edit" }
);
