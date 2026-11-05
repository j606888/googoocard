import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";

// 老師的付款人設定。任何成員可讀。
// linkSuggestion：付款人在老師名單裡有同名、沒連帳號的老師 → 「這位老師是 X 本人嗎？」（開帳清單付款人那一步）。
// 付款人還沒連別的老師時才提醒；任何角色都算（小幫手也可能就是那位老師）。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const [teachers, linked] = await Promise.all([
    prisma.teacher.findMany({
      where: { classroomId, archivedAt: null },
      select: { id: true, name: true, userId: true, payerUserId: true },
      orderBy: { id: "asc" },
    }),
    prisma.teacher.findMany({ where: { classroomId, userId: { not: null } }, select: { userId: true } }),
  ]);
  const payerIds = [...new Set(teachers.flatMap((t) => (t.userId === null && t.payerUserId !== null ? [t.payerUserId] : [])))];
  const payers = await prisma.membership.findMany({
    where: { classroomId, userId: { in: payerIds } },
    select: { userId: true, user: { select: { name: true } } },
  });
  const hasTeacher = new Set(linked.map((t) => t.userId));
  const payerOf = new Map(payers.map((m) => [m.userId, m]));
  return {
    teachers: teachers.map((t) => {
      const payer = t.userId === null && t.payerUserId !== null ? payerOf.get(t.payerUserId) : undefined;
      const match =
        payer &&
        !hasTeacher.has(payer.userId) &&
        payer.user.name.trim() === t.name.trim();
      return { ...t, linkSuggestion: match ? { userId: payer.userId, name: payer.user.name } : null };
    }),
  };
});
