import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { listReassigned, listStrayReceivers, reassignStrayReceivers } from "@/service/finance/strayReceivers";

// 開帳：上線日之後、收款人不是保管人的錢，和已經改記過的（可復原）。任何成員可讀；沒開財務 → 404。
export const GET = apiRoute(async ({ classroomId }) => {
  const [items, reassigned] = await Promise.all([listStrayReceivers(classroomId), listReassigned(classroomId)]);
  return {
    items: items.map((i) => ({ ...i, date: toTaipeiDateKey(i.date) })),
    reassigned: reassigned.map((i) => ({ ...i, date: toTaipeiDateKey(i.date) })),
  };
});

const ids = z.array(z.number().int().positive()).max(1000);
const postSchema = z.object({
  moves: z.array(z.object({ toUserId: z.number().int().positive(), cardIds: ids, dropInIds: ids })).min(1).max(50),
});

// 改記到保管人，一次送好幾組（可以結算的人才能按）。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, postSchema);
  return reassignStrayReceivers({ classroomId, userId, moves: body.moves });
});
