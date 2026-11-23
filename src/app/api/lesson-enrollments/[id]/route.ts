import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { updateEnrollmentSchema } from "@/lib/schemas";
import { deleteEnrollment, updateEnrollment } from "@/service/termEnrollment";

type Params = { id: string };

// 改一筆整期報名的價錢／堂數／備註。
export const PATCH = apiRoute<Params>(async ({ request, params, classroomId }) => {
  const input = await parseBody(request, updateEnrollmentSchema);
  return updateEnrollment(parseId(params.id, "enrollment id"), classroomId, input);
});

// 取消報名（登記錯了才用）：已有出席的不能刪。
export const DELETE = apiRoute<Params>(async ({ params, classroomId }) => {
  await deleteEnrollment(parseId(params.id, "enrollment id"), classroomId);
  return { success: true };
});
