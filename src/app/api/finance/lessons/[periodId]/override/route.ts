import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { overrideLessonSchema } from "@/domains/finance/schemas";
import { overrideLesson } from "@/service/finance/split";

// 驗收時手動改老師實拿（要寫原因）。改錢的事只給能改水庫的人。
export const POST = apiRoute<{ periodId: string }>(
  async ({ request, params, classroomId, userId }) => {
    const { teacherLines, reason } = await parseBody(request, overrideLessonSchema);
    return overrideLesson({ classroomId, userId, periodId: parseId(params.periodId, "period id"), teacherLines, reason });
  },
  { permission: "finance.edit" }
);
