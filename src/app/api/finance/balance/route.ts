import { apiRoute } from "@/lib/apiRoute";
import { getBalances, listUnsettledPeriods } from "@/service/finance/balance";

/** 分部之間誰欠誰＋明細＋還沒結清的課（財務透明：所有成員都看得到）。 */
export const GET = apiRoute(async ({ classroomId }) => {
  const [{ pairs, entries }, unsettled] = await Promise.all([getBalances(classroomId), listUnsettledPeriods(classroomId)]);
  return { pairs, entries, unsettled };
});
