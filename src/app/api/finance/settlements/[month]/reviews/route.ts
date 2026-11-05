import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { reviewBranch } from "@/service/finance/branchReview";
import { parseMonthParam } from "@/service/finance/settlement";

const bodySchema = z.object({ locationId: z.number().int().positive() });

// POST：分部負責人核對這個月這個分部（不擋結算；之後這個分部的資料變動 → 核對自動失效）。
export const POST = apiRoute<{ month: string }>(async ({ request, params, userId, classroomId }) => {
  const month = parseMonthParam(params.month);
  const { locationId } = await parseBody(request, bodySchema);
  return reviewBranch({ classroomId, userId, month, locationId });
});
