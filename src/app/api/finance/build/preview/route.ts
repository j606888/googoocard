import { apiRoute, parseBody } from "@/lib/apiRoute";
import { buildSplitSchema } from "@/domains/finance/schemas";
import { previewBuild } from "@/service/finance/build";

/** 建城最後一題：用還沒存的答案算最近一堂，什麼都不寫。 */
export const POST = apiRoute(
  async ({ request, classroomId }) => previewBuild(classroomId, await parseBody(request, buildSplitSchema)),
  { permission: "finance.edit" }
);
