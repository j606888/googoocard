import { z } from "zod";
import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { getCloseChecklist } from "@/service/ledger/close";
import { todayKey, ymd } from "@/service/ledger/guard";

// 結帳清單（任何成員可讀）。
export const GET = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const { asOf } = parseQuery(request, z.object({ asOf: ymd.optional() }));
  return getCloseChecklist(classroomId, asOf ?? todayKey());
});
