import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { listStrayReceivers, reassignStrayReceivers } from "@/service/finance/strayReceivers";

// 開帳：上線日之後、收款人不是保管人的錢。任何成員可讀；沒開財務 → 404。
export const GET = apiRoute(async ({ classroomId }) => {
  const items = await listStrayReceivers(classroomId);
  return { items: items.map((i) => ({ ...i, date: toTaipeiDateKey(i.date) })) };
});

const postSchema = z.object({
  toUserId: z.number().int().positive(),
  cardIds: z.array(z.number().int().positive()).max(1000),
  dropInIds: z.array(z.number().int().positive()).max(1000),
});

// 改記到一位保管人（可以結算的人才能按）。
export const POST = apiRoute(async ({ request, userId, classroomId }) => {
  const body = await parseBody(request, postSchema);
  return reassignStrayReceivers({ classroomId, userId, ...body });
});
