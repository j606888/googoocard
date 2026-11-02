import { z } from "zod";
import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { assertFinanceEnabled } from "@/service/finance/access";
import { loadPeriodFinance } from "@/service/finance/periods";

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => toTaipeiDateKey(parseTaipeiDateRange(s).start) === s, "Invalid date");

const querySchema = z
  .object({
    from: dateKey.optional(),
    to: dateKey.optional(),
    lessonId: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => (q.from === undefined) === (q.to === undefined), {
    message: "from and to go together",
    path: ["to"],
  })
  .refine((q) => q.from !== undefined || q.lessonId !== undefined, {
    message: "from/to or lessonId is required",
    path: ["_"],
  });

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD（台北日期，含頭含尾）或 ?lessonId=。任何成員可讀。
export const GET = apiRoute(async ({ request, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const q = parseQuery(request, querySchema);
  return loadPeriodFinance(classroomId, {
    ...(q.from && q.to
      ? { from: parseTaipeiDateRange(q.from).start, to: parseTaipeiDateRange(q.to).end }
      : {}),
    ...(q.lessonId !== undefined ? { lessonId: q.lessonId } : {}),
  });
});
