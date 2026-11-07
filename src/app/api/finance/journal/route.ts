import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { createManualEntry, journalSchema, listManualEntries } from "@/service/ledger/records";

// 手動分錄（可以結算的人）。金額單位「分」，正＝借、負＝貸；跨分部自動補往來。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return listManualEntries(classroomId);
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return createManualEntry(classroomId, userId, await parseBody(request, journalSchema));
});
