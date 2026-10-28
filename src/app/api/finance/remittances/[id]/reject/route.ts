import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { rejectSchema } from "@/domains/finance/schemas";
import { rejectRemittance } from "@/service/finance/remittance";

type Params = { id: string };

/** 金額不對：寫原因退回去。 */
export const POST = apiRoute<Params>(
  async ({ request, classroomId, userId, params }) =>
    rejectRemittance(classroomId, userId, parseId(params.id, "remittance id"), (await parseBody(request, rejectSchema)).reason),
  { permission: "finance.view" }
);
