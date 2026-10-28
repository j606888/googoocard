import { apiRoute, parseId } from "@/lib/apiRoute";
import { withdrawRemittance } from "@/service/finance/remittance";

type Params = { id: string };

export const POST = apiRoute<Params>(
  async ({ classroomId, userId, params }) => withdrawRemittance(classroomId, userId, parseId(params.id, "remittance id")),
  { permission: "finance.view" }
);
