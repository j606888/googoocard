import { apiRoute, parseId } from "@/lib/apiRoute";
import { confirmRemittance } from "@/service/finance/remittance";

type Params = { id: string };

export const POST = apiRoute<Params>(
  async ({ classroomId, userId, params }) => confirmRemittance(classroomId, userId, parseId(params.id, "remittance id")),
  { permission: "finance.view" }
);
