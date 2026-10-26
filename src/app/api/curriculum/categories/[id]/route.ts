import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { deleteStructureSchema, patchCategorySchema } from "@/domains/curriculum/schemas";
import { deleteCategory, findCategoryInClassroom } from "@/service/curriculum/skillTree";

type Params = { id: string };

export const PATCH = apiRoute<Params>(
  async ({ request, params, classroomId }) => {
    const category = await findCategoryInClassroom(parseId(params.id, "category id"), classroomId);
    const data = await parseBody(request, patchCategorySchema);
    return prisma.skillCategory.update({
      where: { id: category.id },
      data,
      select: { id: true, name: true, color: true, icon: true, sortOrder: true },
    });
  },
  { permission: "curriculum.edit" }
);

/** 刪分類：技能搬到 `moveTo`，或一起封存（null）。至少要留一個分類。 */
export const DELETE = apiRoute<Params>(
  async ({ request, params, classroomId, userId }) => {
    const category = await findCategoryInClassroom(parseId(params.id, "category id"), classroomId);
    const { moveTo } = await parseBody(request, deleteStructureSchema);
    await deleteCategory(category.id, { classroomId, danceStyleId: category.danceStyleId }, moveTo, userId);
    return { success: true };
  },
  { permission: "curriculum.edit" }
);
