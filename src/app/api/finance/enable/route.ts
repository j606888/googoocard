import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { enableFinance } from "@/service/finance/setup";

const schema = z.object({
  launchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  legacyCustodianUserId: z.number().int().positive(),
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, schema);
  const r = await enableFinance({ classroomId, userId, ...body });
  return { enabled: true, launchDate: r.launchDate };
});
