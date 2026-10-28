import { apiRoute, parseBody } from "@/lib/apiRoute";
import { verifyLessonsSchema } from "@/domains/finance/schemas";
import { verifyLessons } from "@/service/finance/split";

// 驗收：誰都可以（看得到水庫就行），會記下是誰。
export const POST = apiRoute(
  async ({ request, classroomId, userId }) => {
    const { periodIds, batch } = await parseBody(request, verifyLessonsSchema);
    return verifyLessons({ classroomId, userId, periodIds, batch });
  },
  { permission: "finance.view" }
);
