import { z } from "zod";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { assertCanManageFinance } from "@/service/finance/access";
import { settlePeriod, unsettlePeriod } from "@/service/finance/period";

type Params = { periodId: string };

/** 勾「已結清」；paidByUserId 省略 = 開課分部的負責人。 */
export const POST = apiRoute<Params>(async ({ request, params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const periodId = parseId(params.periodId, "period id");
  const { paidByUserId } = await parseBody(request, z.object({ paidByUserId: z.number().int().nullable().optional() }));
  return settlePeriod(classroomId, periodId, { actorUserId: userId, paidByUserId });
});

export const DELETE = apiRoute<Params>(async ({ params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  return unsettlePeriod(classroomId, parseId(params.periodId, "period id"));
});
