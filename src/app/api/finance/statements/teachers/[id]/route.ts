import { z } from "zod";
import { ApiError } from "@/lib/apiError";
import { apiRoute, parseId, parseQuery } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { todayKey, ymd } from "@/service/ledger/guard";
import { syncLedger } from "@/service/ledger/sync";
import { teacherStatement } from "@/service/ledger/overview";

// 老師報酬單（任何成員可讀；P8 再依角色限制）。
export const GET = apiRoute<{ id: string }>(async ({ request, params, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const q = parseQuery(request, z.object({ from: ymd.optional(), to: ymd.optional() }));
  const to = q.to ?? todayKey();
  await syncLedger(classroomId);
  const s = await teacherStatement(classroomId, parseId(params.id), { from: q.from ?? `${to.slice(0, 7)}-01`, to });
  if (!s) throw new ApiError(404, "NOT_FOUND", "Teacher not found");
  return s;
});
