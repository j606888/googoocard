import { apiRoute, parseId } from "@/lib/apiRoute";
import { getPeriodTermInfo } from "@/service/termEnrollment";

type Params = { id: string; periodId: string };

// 點名頁、點名完成頁：這堂的整期學生（誰請假）、每人每堂價、上一堂誰請假。
export const GET = apiRoute<Params>(async ({ params, classroomId }) =>
  getPeriodTermInfo(parseId(params.id, "lesson id"), parseId(params.periodId, "period id"), classroomId)
);
