import { apiRoute, parseId } from "@/lib/apiRoute";
import { skillHistory } from "@/service/curriculum/skillTree";

export const GET = apiRoute<{ id: string }>(
  async ({ params, classroomId }) => skillHistory(parseId(params.id, "skill id"), classroomId),
  { permission: "curriculum.view" }
);
