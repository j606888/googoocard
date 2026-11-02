import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";

// 老師的付款人設定。任何成員可讀。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const teachers = await prisma.teacher.findMany({
    where: { classroomId, archivedAt: null },
    select: { id: true, name: true, userId: true, payerUserId: true },
    orderBy: { id: "asc" },
  });
  return { teachers };
});
