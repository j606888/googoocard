import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { deleteStructureSchema, tierSchema } from "@/domains/curriculum/schemas";
import { deleteTier, findTierInClassroom } from "@/service/curriculum/skillTree";

type Params = { id: string };

export const PATCH = apiRoute<Params>(
  async ({ request, params, classroomId }) => {
    const tier = await findTierInClassroom(parseId(params.id, "tier id"), classroomId);
    const { label } = await parseBody(request, tierSchema);
    return prisma.skillTier.update({
      where: { id: tier.id },
      data: { label },
      select: { id: true, label: true, sortOrder: true },
    });
  },
  { permission: "curriculum.edit" }
);

/** 刪等級：技能搬到 `moveTo`，或一起封存（null）；後面的等級往前補（三轉變二轉）。 */
export const DELETE = apiRoute<Params>(
  async ({ request, params, classroomId, userId }) => {
    const tier = await findTierInClassroom(parseId(params.id, "tier id"), classroomId);
    const { moveTo } = await parseBody(request, deleteStructureSchema);
    await deleteTier(tier.id, { classroomId, danceStyleId: tier.danceStyleId }, moveTo, userId);
    return { success: true };
  },
  { permission: "curriculum.edit" }
);
