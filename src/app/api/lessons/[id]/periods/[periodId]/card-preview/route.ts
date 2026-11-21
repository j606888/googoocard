import { apiRoute } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { previewPeriodCards } from "@/service/attendancePreview";

/**
 * 點名頁：完成點名時每位學生會扣哪張卡、扣完剩幾堂（唯讀）。
 * `?studentIds=1,2,3` = 名冊外、這次勾的人；名冊與已有紀錄的人一律會回。
 */
export const GET = apiRoute<{ id: string; periodId: string }>(async ({ request, params, classroomId }) => {
  const extraStudentIds = (new URL(request.url).searchParams.get("studentIds") ?? "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const previews = await previewPeriodCards({
    lessonId: Number(params.id),
    periodId: Number(params.periodId),
    classroomId,
    extraStudentIds,
  });
  if (!previews) throw notFound("Lesson period");
  return previews;
});
