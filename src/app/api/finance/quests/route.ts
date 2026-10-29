import { apiRoute, parseBody } from "@/lib/apiRoute";
import { questSchema } from "@/domains/finance/schemas";
import { getQuests, markQuest } from "@/service/finance/quests";

/** 我的新手任務（依角色合併）。 */
export const GET = apiRoute(async ({ classroomId, userId, role, permissions }) => getQuests(classroomId, userId, role, permissions.has("finance.edit")), {
  permission: "finance.view",
});

/** 資料推不出來的任務，由畫面標記完成（試玩推車、看過背包、通知過大家）。 */
export const POST = apiRoute(
  async ({ request, classroomId, userId }) =>
    markQuest(classroomId, userId, (await parseBody(request, questSchema)).quest),
  { permission: "finance.view" }
);
