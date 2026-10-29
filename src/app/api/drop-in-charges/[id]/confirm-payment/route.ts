import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { confirmPaymentSchema } from "@/lib/schemas";
import { confirmDropInPayment } from "@/service/dropIn";

type Params = { id: string };

// 單堂費確認收款，欄位同課卡的 confirm-payment。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const body = await parseBody(request, confirmPaymentSchema);
  return confirmDropInPayment({
    classroomId,
    userId,
    chargeId: parseId(params.id, "drop-in charge id"),
    ...body,
  });
});
