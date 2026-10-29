import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { confirmDropInPaymentSchema } from "@/lib/schemas";
import { confirmDropInPayment } from "@/service/dropIn";

type Params = { id: string };

// 單堂費確認收款，欄位同課卡的 confirm-payment，多一個 amount（實收）。
export const POST = apiRoute<Params>(async ({ request, params, userId, classroomId }) => {
  const body = await parseBody(request, confirmDropInPaymentSchema);
  return confirmDropInPayment({
    classroomId,
    userId,
    chargeId: parseId(params.id, "drop-in charge id"),
    ...body,
  });
});
