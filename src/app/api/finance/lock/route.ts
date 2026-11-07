import { apiRoute, parseBody } from "@/lib/apiRoute";
import { assertFinanceEnabled } from "@/service/finance/access";
import { getLockState, lockSchema, setLockDate } from "@/service/ledger/close";

// 鎖帳日：往後推＝可以結算的人；往前／解鎖＝owner。每次變更都留紀錄。
export const GET = apiRoute(async ({ classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return getLockState(classroomId);
});

export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  await assertFinanceEnabled(classroomId);
  return setLockDate(classroomId, userId, await parseBody(request, lockSchema));
});
