import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { badRequest, notFound } from "@/lib/apiError";
import { assertCanManageFinance } from "@/service/finance/access";

/** 改一張卡的「錢的分部」或「卡的分部」。已結清的課不會跟著改（快照）。 */
export const PATCH = apiRoute<{ id: string }>(async ({ request, params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const id = parseId(params.id, "student card id");
  const body = await parseBody(
    request,
    z.object({
      moneyLocationId: z.number().int().nullable().optional(),
      homeLocationId: z.number().int().nullable().optional(),
    })
  );
  const card = await prisma.studentCard.findFirst({ where: { id, student: { classroomId } }, select: { id: true } });
  if (!card) throw notFound("Student card");
  const ids = [body.moneyLocationId, body.homeLocationId].filter((x): x is number => typeof x === "number");
  if (ids.length) {
    const count = await prisma.location.count({ where: { classroomId, id: { in: ids } } });
    if (count !== new Set(ids).size) throw badRequest("CARD_BAD_BRANCH", "Branch not in this classroom");
  }
  return prisma.studentCard.update({
    where: { id },
    data: body,
    select: { id: true, moneyLocationId: true, homeLocationId: true },
  });
});
