import { apiRoute, parseBody } from "@/lib/apiRoute";
import { revenueOwnerSchema } from "@/domains/finance/schemas";
import { setRevenueOwner } from "@/service/finance/setting";

/** 建城前選營收負責人。 */
export const PUT = apiRoute(
  async ({ request, classroomId }) =>
    setRevenueOwner(classroomId, (await parseBody(request, revenueOwnerSchema)).revenueOwnerUserId),
  { permission: "finance.edit" }
);
