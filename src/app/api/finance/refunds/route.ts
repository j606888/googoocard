import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertCanSettle } from "@/service/finance/access";
import { dateOf, refundCard } from "@/service/finance/cash";
import { ymdSchema } from "@/lib/schemas";

const schema = z.object({
  studentCardId: z.number().int().positive(),
  amount: z.number().int().min(0),
  paidByUserId: z.number().int().positive(),
  date: ymdSchema,
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertCanSettle(userId, classroomId);
  const body = await parseBody(request, schema);
  return refundCard({ classroomId, userId, ...body, date: dateOf(body.date) });
});
