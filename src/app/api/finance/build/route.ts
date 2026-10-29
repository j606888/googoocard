import { apiRoute, parseBody } from "@/lib/apiRoute";
import { buildSplitSchema } from "@/domains/finance/schemas";
import { saveBuild } from "@/service/finance/build";

/** 開城：建城第 2～4 章的分帳答案一次存（全教室＋各分部場地費，從頭算）。 */
export const POST = apiRoute(
  async ({ request, classroomId, userId }) => saveBuild(classroomId, userId, await parseBody(request, buildSplitSchema)),
  { permission: "finance.edit" }
);
