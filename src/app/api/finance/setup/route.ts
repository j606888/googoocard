import { apiRoute, parseBody } from "@/lib/apiRoute";
import { setupSchema } from "@/domains/finance/schemas";
import { setup } from "@/service/finance/setting";

/** 建城 5 題一次送。finance.edit 或已被選為營收負責人的人可以做（權限在 service 判斷）。 */
export const POST = apiRoute(
  async ({ request, classroomId, userId, permissions }) =>
    setup(classroomId, userId, permissions.has("finance.edit"), await parseBody(request, setupSchema)),
  { permission: "finance.view" }
);
