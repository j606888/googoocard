import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { teacherMonthSchema } from "@/domains/finance/schemas";
import { getTeacherMonth } from "@/service/finance/split";

// 老師薪水（月中累積）。能改水庫的人看全部；其他人只看自己的。
export const GET = apiRoute(
  async ({ request, classroomId, userId, permissions }) => {
    const { month } = parseQuery(request, teacherMonthSchema);
    return getTeacherMonth(classroomId, month ?? toTaipeiMonthKey(new Date()), {
      userId,
      canSeeAll: permissions.has("finance.edit"),
    });
  },
  { permission: "finance.view" }
);
