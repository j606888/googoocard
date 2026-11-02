import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinance } from "@/service/finance/access";

// 確認舊卡預收總額（開帳清單最後一項）。
export const POST = apiRoute(async ({ userId, classroomId }) => {
  await assertFinance(userId, classroomId);
  const c = await prisma.classroom.update({
    where: { id: classroomId },
    data: { legacyPrepaidConfirmedAt: new Date() },
    select: { legacyPrepaidConfirmedAt: true },
  });
  return { legacyPrepaidConfirmedAt: c.legacyPrepaidConfirmedAt };
});
