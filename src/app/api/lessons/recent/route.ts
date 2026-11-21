import { apiRoute } from "@/lib/apiRoute";
import { getRecentPeriods } from "@/service/recentPeriods";

/** 「今天」頁的「最近上過」：最近點過名的時段，帶人數與收入。 */
export const GET = apiRoute(async ({ request, classroomId }) => {
  const limit = Number(new URL(request.url).searchParams.get("limit"));
  return getRecentPeriods(classroomId, Number.isFinite(limit) && limit > 0 ? limit : undefined);
});
