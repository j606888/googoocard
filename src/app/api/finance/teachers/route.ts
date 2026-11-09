import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";

// 財務用的老師名單（開帳「還沒付的錢」選對象、財務設定的連結建議）。任何成員可讀。
// 老師的錢一律由上課那個分部的負責人付（service/ledger/payouts.ts），這裡不再有付款人。
// linkSuggestion：沒連帳號的老師，跟某位還沒連老師的成員同名 → 「這位老師是 X 本人嗎？」。
// 任何角色都算（小幫手也可能就是那位老師）；同名的成員不只一位就不猜。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  const [teachers, linked, members] = await Promise.all([
    prisma.teacher.findMany({
      where: { classroomId, archivedAt: null },
      select: { id: true, name: true, userId: true },
      orderBy: { id: "asc" },
    }),
    prisma.teacher.findMany({ where: { classroomId, userId: { not: null } }, select: { userId: true } }),
    prisma.membership.findMany({ where: { classroomId }, select: { userId: true, user: { select: { name: true } } } }),
  ]);
  const hasTeacher = new Set(linked.map((t) => t.userId));
  const byName = new Map<string, { userId: number; name: string }[]>();
  for (const m of members) {
    if (hasTeacher.has(m.userId)) continue;
    const key = m.user.name.trim();
    byName.set(key, [...(byName.get(key) ?? []), { userId: m.userId, name: m.user.name }]);
  }
  return {
    teachers: teachers.map((t) => {
      const match = t.userId === null ? byName.get(t.name.trim()) : undefined;
      return { ...t, linkSuggestion: match?.length === 1 ? match[0] : null };
    }),
  };
});
