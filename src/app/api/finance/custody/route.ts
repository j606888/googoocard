import { z } from "zod";
import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { getCustody } from "@/service/finance/custody";

const querySchema = z.object({
  through: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "through must be YYYY-MM")
    .optional(),
});

// GET ?through=YYYY-MM（選填）。任何成員可讀；財務沒開 → 404 FINANCE_DISABLED。
export const GET = apiRoute(async ({ request, classroomId }) => {
  const q = parseQuery(request, querySchema);
  return getCustody(classroomId, q.through);
});
