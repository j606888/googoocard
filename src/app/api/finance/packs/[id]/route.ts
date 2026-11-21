import prisma from "@/lib/prisma";
import { apiRoute, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { assertCanManageFinance } from "@/service/finance/access";

/** 作廢一包（記錯了）。已結清的課照舊記著它，不會改。 */
export const DELETE = apiRoute<{ id: string }>(async ({ params, classroomId, userId, role }) => {
  await assertCanManageFinance(classroomId, userId, role);
  const id = parseId(params.id, "pack id");
  const pack = await prisma.venuePack.findFirst({ where: { id, classroomId, voidedAt: null } });
  if (!pack) throw notFound("Pack");
  return prisma.venuePack.update({ where: { id }, data: { voidedAt: new Date() } });
});
