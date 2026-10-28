import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { setPeriodAssistantsSchema } from "@/lib/schemas";
import { getPeriodAssistants, setPeriodAssistants } from "@/service/lessonAssistants";

type Params = { id: string; periodId: string };

// 這堂的助教（src/service/lessonAssistants.ts）。還沒記過時帶同一天上一堂的建議。
export const GET = apiRoute<Params>(async ({ params, classroomId }) =>
  getPeriodAssistants({
    classroomId,
    lessonId: parseId(params.id, "lesson id"),
    periodId: parseId(params.periodId, "period id"),
  })
);

// 點名送出時一起存：整組覆寫。
export const PUT = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const { teacherIds } = await parseBody(request, setPeriodAssistantsSchema);
  return setPeriodAssistants({
    classroomId,
    lessonId: parseId(params.id, "lesson id"),
    periodId: parseId(params.periodId, "period id"),
    teacherIds,
  });
});
