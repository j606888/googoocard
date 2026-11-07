import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { ensureLedgerSetup } from "@/service/ledger/setup";

// 科目表（手動分錄選科目、總分類帳選科目用）。任何成員可讀。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  await ensureLedgerSetup(classroomId);
  const accounts = await prisma.ledgerAccount.findMany({
    where: { classroomId },
    select: { id: true, code: true, name: true, type: true, systemKey: true, parentId: true, archivedAt: true },
    orderBy: { code: "asc" },
  });
  return { accounts };
});
