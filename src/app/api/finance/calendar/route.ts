import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { teacherMonthSchema } from "@/domains/finance/schemas";
import { getFinanceCalendar } from "@/service/finance/split";

// 水庫行事曆：每天的驗收狀態＋錢的事（?month=YYYY-MM，不送＝這個月）。
export const GET = apiRoute(
  async ({ request, classroomId }) => {
    const { month } = parseQuery(request, teacherMonthSchema);
    return getFinanceCalendar(classroomId, month ?? toTaipeiMonthKey(new Date()));
  },
  { permission: "finance.view" }
);
