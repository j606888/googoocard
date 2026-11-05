import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";

// 有分帳規則的課（「從另一門課複製規則」的選項）。任何成員可讀。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const lessons = await prisma.lesson.findMany({
    where: { classroomId, splitRule: { isNot: null } },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return { lessons };
});
