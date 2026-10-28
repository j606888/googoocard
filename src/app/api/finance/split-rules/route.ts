import { apiRoute, parseBody } from "@/lib/apiRoute";
import { splitRuleSchema } from "@/domains/finance/schemas";
import { getSplitRules, saveSplitRule } from "@/service/finance/split";

// 分帳規則：全教室 → 分部 → 課程三層，每一列是某一層從某天起的設定（含歷史）。
export const GET = apiRoute(async ({ classroomId }) => getSplitRules(classroomId), {
  permission: "finance.view",
});

export const PUT = apiRoute(
  async ({ request, classroomId, userId }) =>
    saveSplitRule(classroomId, userId, await parseBody(request, splitRuleSchema)),
  { permission: "finance.edit" }
);
