import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { conversionDateParam, listReassigned, listStrayReceivers, reassignStrayReceivers } from "@/service/finance/strayReceivers";

// 開帳：收款人不是保管人、帳本又會用到他資金帳戶的錢，和已經改記過的（可復原）。任何成員可讀；沒開財務 → 404。
// ?conversionDate=YYYY-MM-DD：精靈草稿的轉換日（沒帶 → 已開帳的轉換日／開財務那天）。
export const GET = apiRoute(async ({ request, classroomId }) => {
  const [items, reassigned] = await Promise.all([
    listStrayReceivers(classroomId, conversionDateParam(request)),
    listReassigned(classroomId),
  ]);
  return {
    items: items.map((i) => ({ ...i, date: toTaipeiDateKey(i.date) })),
    reassigned: reassigned.map((i) => ({ ...i, date: toTaipeiDateKey(i.date) })),
  };
});

const ids = z.array(z.number().int().positive()).max(1000);
const postSchema = z.object({
  moves: z.array(z.object({ toUserId: z.number().int().positive(), cardIds: ids, dropInIds: ids })).min(1).max(50),
  /** 草稿的轉換日：照這天判斷要改記哪些；帶了也能改記開帳的舊卡（保管人 → 保管人）。 */
  conversionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// 改記到保管人，一次送好幾組（可以結算的人才能按）。帶 conversionDate 也能改記開帳的舊卡。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, postSchema);
  return reassignStrayReceivers({ classroomId, userId, moves: body.moves, conversionDate: body.conversionDate });
});
