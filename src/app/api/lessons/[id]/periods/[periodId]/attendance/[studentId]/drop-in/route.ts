import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { chargeDropInSchema } from "@/lib/schemas";
import { chargeDropIn } from "@/service/dropIn";

type Params = { id: string; periodId: string; studentId: string };

// 這筆出席不扣課卡，改收單堂（預設這堂課的單堂價，可改；src/service/dropIn.ts）。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const { amount, ...payment } = await parseBody(request, chargeDropInSchema);
  return chargeDropIn({
    classroomId,
    userId,
    lessonId: parseId(params.id, "lesson id"),
    lessonPeriodId: parseId(params.periodId, "period id"),
    studentId: parseId(params.studentId, "student id"),
    amount,
    payment,
  });
});
