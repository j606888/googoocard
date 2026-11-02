import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";

// 分部的財務設定（負責人、過期收入對象、公積金期初）。任何成員可讀。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const locations = await prisma.location.findMany({
    where: { classroomId, archivedAt: null },
    select: {
      id: true,
      name: true,
      keeperUserId: true,
      expiryTo: true,
      expiryUserId: true,
      fundOpening: true,
      fundOpeningConfirmedAt: true,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return { locations };
});
