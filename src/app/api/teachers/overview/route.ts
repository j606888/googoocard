import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { teacherMonthQuerySchema } from "@/lib/schemas";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { getTeachersOverview } from "@/service/teachers";

// The teachers page: every teacher with the month's numbers and trend.
export const GET = apiRoute(async ({ request, classroomId }) => {
  const { month } = parseQuery(request, teacherMonthQuerySchema);
  return getTeachersOverview(classroomId, month ?? toTaipeiMonthKey(new Date()));
});
