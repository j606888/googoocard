import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { lessonSplitsQuerySchema } from "@/domains/finance/schemas";
import { getLessonSplits } from "@/service/finance/split";

// 每堂分帳＋驗收狀態（src/service/finance/split.ts）。
export const GET = apiRoute(
  async ({ request, classroomId }) => {
    const { from, to } = parseQuery(request, lessonSplitsQuerySchema);
    return getLessonSplits(classroomId, from, to);
  },
  { permission: "finance.view" }
);
