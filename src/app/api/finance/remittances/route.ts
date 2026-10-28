import { apiRoute, parseBody } from "@/lib/apiRoute";
import { remittanceSchema } from "@/domains/finance/schemas";
import { createRemittance } from "@/service/finance/remittance";

/** 送回主堡。誰都可以是代收人。 */
export const POST = apiRoute(
  async ({ request, classroomId, userId }) =>
    createRemittance(classroomId, userId, await parseBody(request, remittanceSchema)),
  { permission: "finance.view" }
);
