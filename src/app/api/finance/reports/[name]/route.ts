import { z } from "zod";
import { ApiError } from "@/lib/apiError";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { REPORTS, runReport, type ReportName } from "@/service/ledger/reports";

// 財務 v2 報表（docs/finance-v2/05 §3）。任何成員可讀（財務全部透明）。金額單位「分」。
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  from: ymd.optional(),
  to: ymd.optional(),
  asOf: ymd.optional(),
  locationId: z.coerce.number().int().positive().optional(),
  accountId: z.coerce.number().int().positive().optional(),
});

export const GET = apiRoute<{ name: string }>(async ({ request, params, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  if (!(REPORTS as readonly string[]).includes(params.name)) throw new ApiError(404, "NOT_FOUND", "Unknown report");
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(q);
  if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", parsed.error.issues.map((i) => i.message).join("; "));
  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) throw new ApiError(400, "INVALID_RANGE", "from must be on or before to");
  return runReport(classroomId, params.name as ReportName, parsed.data);
});
