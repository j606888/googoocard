import { z } from "zod";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { ymd } from "@/service/ledger/guard";
import { financeOverview } from "@/service/ledger/overview";

// 財務 v2 總覽（任何成員可讀）。金額單位「分」。
export const GET = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const q = parseQuery(request, z.object({ from: ymd.optional(), to: ymd.optional() }));
  if (q.from && q.to && q.from > q.to) throw new ApiError(400, "INVALID_RANGE", "from must be on or before to");
  return financeOverview(classroomId, q);
});
