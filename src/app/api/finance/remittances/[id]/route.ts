import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { remittanceSchema } from "@/domains/finance/schemas";
import { updateRemittance } from "@/service/finance/remittance";

type Params = { id: string };

/** 送的人改（轉交中的，或被退回的改完重送）。 */
export const PATCH = apiRoute<Params>(
  async ({ request, classroomId, userId, params }) =>
    updateRemittance(classroomId, userId, parseId(params.id, "remittance id"), await parseBody(request, remittanceSchema)),
  { permission: "finance.view" }
);
