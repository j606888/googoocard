import { apiRoute, parseBody } from "@/lib/apiRoute";
import { categorySchema } from "@/domains/curriculum/schemas";
import { createCategory, styleScope } from "@/service/curriculum/skillTree";

export const POST = apiRoute<{ danceStyleId: string }>(
  async ({ request, params, classroomId }) => {
    const scope = await styleScope(params.danceStyleId, classroomId);
    return createCategory(scope, await parseBody(request, categorySchema));
  },
  { permission: "curriculum.edit" }
);
