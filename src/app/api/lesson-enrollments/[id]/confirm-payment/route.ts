import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { confirmPaymentSchema } from "@/lib/schemas";
import { confirmEnrollmentPayment } from "@/service/termEnrollment";

type Params = { id: string };

// 整期報名確認收款，欄位同課卡的 confirm-payment。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const body = await parseBody(request, confirmPaymentSchema);
  return confirmEnrollmentPayment({
    classroomId,
    userId,
    enrollmentId: parseId(params.id, "enrollment id"),
    ...body,
  });
});
